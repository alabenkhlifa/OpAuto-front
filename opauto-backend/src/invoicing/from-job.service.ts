import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicingService } from './invoicing.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

/**
 * FromJobService — converts a completed `MaintenanceJob` into a DRAFT
 * invoice.
 *
 * Line-source priority:
 * 1) durable `MaintenanceJobLineItem` rows when they exist.
 * 2) fallback to legacy job stock-outs (`reason='job:<id>'`) for older
 *    jobs created before durable line persistence landed.
 *
 * Labor is pulled from:
 * - durable labor lines when present, otherwise
 * - job `actualHours` or `estimatedHours` + assigned employee.
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
    // ── 1. Load + tenant scope ────────────────────────────────
    const job = (await this.prisma.maintenanceJob.findUnique({
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
        parts: {
          include: {
            part: {
              select: {
                id: true,
                name: true,
                unitPrice: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })) as any;
    // Don't leak existence — return 404 for both not-found and cross-tenant.
    if (!job || job.garageId !== garageId) {
      throw new NotFoundException('Maintenance job not found');
    }

    // ── 2. Reject if any invoice already references this job ──
    const existing = await this.prisma.invoice.findFirst({
      where: { maintenanceJobId: jobId, garageId },
      select: { id: true, invoiceNumber: true, status: true },
    });
    if (existing) {
      throw new ConflictException(
        `Invoice ${existing.invoiceNumber} already exists for this maintenance job`,
      );
    }

    const lines = (job as any).parts ?? [];
    const durablePartLines = lines.filter((line: any) => line.type === 'part');
    const durableLaborLines = lines.filter((line: any) => line.type === 'labor');

    // ── 3. Derive part usage from durable lines or stock movements.
    const lineItems = [] as CreateInvoiceDto['lineItems'];

    if (durablePartLines.length > 0) {
      for (const line of durablePartLines) {
        lineItems.push({
          description: line.description || (line.part?.name ?? 'Part'),
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          type: 'part',
          partId: line.partId ?? undefined,
          serviceCode: line.serviceCode ?? undefined,
          mechanicId: line.mechanicId ?? undefined,
          laborHours: line.laborHours ?? undefined,
          tvaRate: line.tvaRate ?? undefined,
          discountPct: line.discountPct ?? undefined,
        });
      }
    } else {
      const stockBasedPartLines = await this.prisma.stockMovement.findMany({
        where: { reason: `job:${jobId}`, type: 'out' },
        select: {
          partId: true,
          quantity: true,
          part: {
            select: { id: true, name: true, unitPrice: true, garageId: true },
          },
        },
      });

      const partLines = new Map<string, {
        description: string;
        quantity: number;
        unitPrice: number;
        partId?: string;
      }>();

      for (const mv of stockBasedPartLines) {
        if (!mv.part || mv.part.garageId !== garageId) continue;

        const key = mv.partId;
        const existingLine = partLines.get(key);
        if (existingLine) {
          existingLine.quantity += mv.quantity;
          continue;
        }

        partLines.set(key, {
          description: mv.part.name,
          partId: mv.partId,
          unitPrice: mv.part.unitPrice ?? 0,
          quantity: mv.quantity,
        });
      }

      for (const p of partLines.values()) {
        lineItems.push({
          description: p.description,
          quantity: p.quantity,
          unitPrice: p.unitPrice,
          type: 'part',
          partId: p.partId,
        });
      }
    }

    // ── 4. Derive labor lines from durable labor lines or fallback.
    if (durableLaborLines.length > 0) {
      for (const line of durableLaborLines) {
        const fallbackName = job.employee
          ? `${job.employee.firstName} ${job.employee.lastName}`
          : 'Mechanic';

        lineItems.push({
          description:
            line.description || `Labor — ${fallbackName}`,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          type: 'labor',
          serviceCode: line.serviceCode ?? undefined,
          mechanicId: line.mechanicId ?? (job as any).employee?.id,
          laborHours: line.laborHours ?? line.quantity,
          tvaRate: line.tvaRate ?? undefined,
          discountPct: line.discountPct ?? undefined,
        });
      }
    } else {
      const laborHours = job.actualHours ?? job.estimatedHours ?? 0;
      const employee = (job as any).employee;
      if (laborHours > 0 && employee != null) {
        lineItems.push({
          description: `Labor — ${employee.firstName} ${employee.lastName}`,
          quantity: laborHours,
          unitPrice: employee?.hourlyRate ?? 0,
          type: 'labor',
          mechanicId: employee?.id,
          laborHours,
        });
      }
    }

    if (lineItems.length === 0) {
      const storedJobCost =
        typeof job.actualCost === 'number' && job.actualCost > 0
          ? job.actualCost
          : typeof job.estimatedCost === 'number' && job.estimatedCost > 0
            ? job.estimatedCost
            : 0;

      if (storedJobCost > 0) {
        lineItems.push({
          description: job.title
            ? `Maintenance — ${job.title}`
            : 'Maintenance service',
          quantity: 1,
          unitPrice: storedJobCost,
          type: 'service',
        });
      }
    }

    if (lineItems.length === 0) {
      throw new BadRequestException(
        'Maintenance job has no billable items — log parts used or labor hours first',
      );
    }

    const invoice = await this.invoicing.create(garageId, {
      customerId: job.car.customerId,
      carId: job.carId,
      lineItems,
      notes: body.notes,
      dueDate: body.dueDate,
    });

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        maintenanceJobId: jobId,
      },
    });

    // Return fresh fetch so callers see all metadata.
    return this.invoicing.findOne(invoice.id, garageId);
  }
}
