import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicingService } from './invoicing.service';
import { CreateInvoiceDto, CreateLineItemDto } from './dto/create-invoice.dto';

/**
 * FromJobService — converts a completed `MaintenanceJob` into a DRAFT
 * invoice with one line per part used and one line per mechanic.
 *
 * The schema as of Phase 2 does NOT carry a `MaintenanceJobPart[]`
 * pivot — parts are tracked indirectly via the `InvoiceLineItem.partId`
 * column once an invoice is created. To bridge the gap until the
 * pivot model lands, this service builds the line items from:
 *   - the job's previously created InvoiceLineItem rows that already
 *     reference `maintenanceJobId` (parts and labor a previous draft
 *     captured), OR
 *   - the job's `actualHours` + assigned `employee` (single labor line).
 *
 * In practice the v1 flow will be: a maintenance job persists its
 * "parts used" list as a transient set that the front-end ships in the
 * conversion request — but Phase 2 keeps the surface small. We expose a
 * route that:
 *   1. Looks for a previous DRAFT invoice tied to the job → returns 409
 *      if any non-cancelled invoice already references the job.
 *   2. Inspects the job's `employee` + `actualHours` (or `estimatedHours`)
 *      to derive a labor line, and pulls `recentParts` from the most
 *      recent `StockMovement(type='out', reason like 'job:<id>')` rows
 *      so part usage logged via inventory adjustments still flows in.
 *
 * If neither parts nor labor can be derived, we throw a 400 — the
 * caller is told their job has nothing billable yet.
 */
@Injectable()
export class FromJobService {
  constructor(
    private prisma: PrismaService,
    private invoicing: InvoicingService,
  ) {}

  async createFromJob(
    jobId: string,
    garageId: string,
    body: { dueDate?: string; notes?: string } = {},
  ) {
    // ── 1. Load + tenant scope ─────────────────────────────────
    const job = await this.prisma.maintenanceJob.findUnique({
      where: { id: jobId },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            hourlyRate: true,
          },
        },
        car: {
          select: {
            id: true,
            customerId: true,
            make: true,
            model: true,
            licensePlate: true,
          },
        },
      },
    });
    // Don't leak existence — return 404 for both not-found and cross-tenant.
    if (!job || job.garageId !== garageId) {
      throw new NotFoundException('Maintenance job not found');
    }

    // ── 2. Reject if any invoice already references this job ───
    const existing = await this.prisma.invoice.findFirst({
      where: { maintenanceJobId: jobId, garageId },
      select: { id: true, invoiceNumber: true, status: true },
    });
    if (existing) {
      throw new ConflictException(
        `Invoice ${existing.invoiceNumber} already exists for this maintenance job`,
      );
    }

    // ── 3. Derive part usage from StockMovement rows tagged with
    //       `reason='job:<jobId>'` and type='out'. This is the
    //       convention used by inventory adjustments made during a
    //       maintenance job — see InventoryService.adjustStock + the
    //       `reason` free-text column on StockMovement.
    const partOuts = await this.prisma.stockMovement.findMany({
      where: { reason: `job:${jobId}`, type: 'out' },
      select: {
        partId: true,
        quantity: true,
        part: {
          select: { id: true, name: true, unitPrice: true, garageId: true },
        },
      },
    });

    // Aggregate by partId — multiple stock-out events for the same part
    // collapse into a single invoice line.
    const partLines = new Map<
      string,
      { name: string; unitPrice: number; quantity: number }
    >();
    for (const mv of partOuts) {
      // Defensive cross-garage filter even though the job is already
      // garage-scoped (parts can in principle be moved across garages).
      if (!mv.part || mv.part.garageId !== garageId) continue;
      const acc = partLines.get(mv.partId);
      if (acc) {
        acc.quantity += mv.quantity;
      } else {
        partLines.set(mv.partId, {
          name: mv.part.name,
          unitPrice: mv.part.unitPrice ?? 0,
          quantity: mv.quantity,
        });
      }
    }

    // ── 4. Derive labor line from the assigned mechanic + actualHours
    //       (fallback to estimatedHours if actual not yet logged).
    const laborHours = job.actualHours ?? job.estimatedHours ?? 0;
    const hourlyRate = job.employee?.hourlyRate ?? 0;
    const hasLabor = laborHours > 0 && job.employee != null;

    const lineItems: CreateLineItemDto[] = [];
    for (const [partId, line] of partLines.entries()) {
      lineItems.push({
        description: line.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        type: 'part',
      });
      // partId is plumbed via the post-create patch below since
      // CreateLineItemDto does not yet expose it — keep the public
      // DTO stable and write the partId straight on the saved row.
      (line as any).partId = partId;
    }

    if (hasLabor) {
      lineItems.push({
        description: `Labor — ${job.employee!.firstName} ${job.employee!.lastName}`,
        quantity: laborHours,
        // TODO: when Employee.hourlyRate is missing, fall back to a
        // garage-level default hourly rate (Phase 3). For now an
        // unset hourlyRate yields a 0 unit-price line which the
        // owner can edit before issuing.
        unitPrice: hourlyRate,
        type: 'labor',
      });
    }

    if (lineItems.length === 0) {
      throw new BadRequestException(
        'Maintenance job has no billable items — log parts used or labor hours first',
      );
    }

    // ── 5. Hand off to InvoicingService.create() so totals + TVA
    //       computation stay in one place. We patch maintenanceJobId,
    //       partId, and mechanicId on the persisted rows afterwards.
    const dto: CreateInvoiceDto = {
      customerId: job.car.customerId,
      carId: job.carId,
      lineItems,
      notes: body.notes,
      dueDate: body.dueDate,
    };
    const invoice = await this.invoicing.create(garageId, dto);

    // Patch maintenanceJobId, partId on parts lines, mechanicId on labor.
    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { maintenanceJobId: jobId },
    });

    // Persisted line ids aren't guaranteed to be ordered (UUIDs), so
    // match each persisted row to a source DTO entry by content key
    // (description + type + qty + unitPrice). This is unique enough
    // within an invoice for our derivation paths.
    const persistedLines = await this.prisma.invoiceLineItem.findMany({
      where: { invoiceId: invoice.id },
    });
    const partIdsByLineKey = new Map<string, string>();
    for (const [partId, line] of partLines.entries()) {
      const key = `part|${line.name}|${line.quantity}|${line.unitPrice}`;
      partIdsByLineKey.set(key, partId);
    }
    for (const li of persistedLines) {
      const key = `${li.type ?? ''}|${li.description}|${li.quantity}|${li.unitPrice}`;
      const partId = partIdsByLineKey.get(key);
      if (li.type === 'part' && partId) {
        await this.prisma.invoiceLineItem.update({
          where: { id: li.id },
          data: { partId },
        });
      } else if (li.type === 'labor' && hasLabor) {
        await this.prisma.invoiceLineItem.update({
          where: { id: li.id },
          data: {
            mechanicId: job.employee!.id,
            laborHours,
          },
        });
      }
    }

    // Return a fresh fetch so the caller sees the patched fields.
    return this.invoicing.findOne(invoice.id, garageId);
  }
}
