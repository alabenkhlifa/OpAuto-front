import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { RespondApprovalDto } from './dto/respond-approval.dto';

@Injectable()
export class ApprovalsService {
  constructor(private prisma: PrismaService) {}

  async findAll(garageId: string) {
    const approvals = await this.prisma.approval.findMany({ where: { garageId }, orderBy: { createdAt: 'desc' } });
    return this.attachUserNames(approvals);
  }

  async findOne(id: string, garageId: string) {
    const approval = await this.prisma.approval.findFirst({ where: { id, garageId } });
    if (!approval) throw new NotFoundException('Approval not found');
    const [withNames] = await this.attachUserNames([approval]);
    return withNames;
  }

  async create(garageId: string, userId: string, dto: CreateApprovalDto) {
    const created = await this.prisma.approval.create({ data: { ...dto, garageId, requestedBy: userId } });
    const [withNames] = await this.attachUserNames([created]);
    return withNames;
  }

  async respond(id: string, garageId: string, userId: string, dto: RespondApprovalDto) {
    await this.findOne(id, garageId);
    const updated = await this.prisma.approval.update({
      where: { id },
      data: { status: dto.status, responseNote: dto.responseNote, respondedBy: userId, respondedAt: new Date() },
    });
    const [withNames] = await this.attachUserNames([updated]);
    return withNames;
  }

  /**
   * Approval.requestedBy / respondedBy are plain user-id strings (no Prisma
   * relation). Resolve them to display names in one batch so the UI can show
   * "Approved by X on Apr 10" without N+1 lookups from the frontend.
   */
  private async attachUserNames(approvals: any[]) {
    const ids = new Set<string>();
    for (const a of approvals) {
      if (a.requestedBy) ids.add(a.requestedBy);
      if (a.respondedBy) ids.add(a.respondedBy);
    }
    if (ids.size === 0) return approvals;
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, firstName: true, lastName: true },
    });
    const nameOf = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
    return approvals.map((a) => ({
      ...a,
      requesterName: a.requestedBy ? nameOf.get(a.requestedBy) || null : null,
      responderName: a.respondedBy ? nameOf.get(a.respondedBy) || null : null,
    }));
  }
}
