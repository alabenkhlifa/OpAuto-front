import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { RespondApprovalDto } from './dto/respond-approval.dto';

@Injectable()
export class ApprovalsService {
  constructor(private prisma: PrismaService) {}

  async findAll(garageId: string) {
    return this.prisma.approval.findMany({ where: { garageId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, garageId: string) {
    const approval = await this.prisma.approval.findFirst({ where: { id, garageId } });
    if (!approval) throw new NotFoundException('Approval not found');
    return approval;
  }

  async create(garageId: string, userId: string, dto: CreateApprovalDto) {
    return this.prisma.approval.create({ data: { ...dto, garageId, requestedBy: userId } });
  }

  async respond(id: string, garageId: string, userId: string, dto: RespondApprovalDto) {
    await this.findOne(id, garageId);
    return this.prisma.approval.update({
      where: { id },
      data: { status: dto.status, responseNote: dto.responseNote, respondedBy: userId, respondedAt: new Date() },
    });
  }
}
