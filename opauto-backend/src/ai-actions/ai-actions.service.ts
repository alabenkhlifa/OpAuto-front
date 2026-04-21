import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { SmsService } from '../sms/sms.service';
import { ApproveActionDto } from './dto/approve-action.dto';
import { ListActionsDto } from './dto/list-actions.dto';
import { RedeemActionDto } from './dto/redeem-action.dto';

const ACTION_INCLUDE = {
  customer: { select: { id: true, firstName: true, lastName: true, phone: true, smsOptIn: true } },
} satisfies Prisma.AiActionInclude;

export type AiActionWithCustomer = Prisma.AiActionGetPayload<{ include: typeof ACTION_INCLUDE }>;

@Injectable()
export class AiActionsService {
  private readonly logger = new Logger(AiActionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly sms: SmsService,
  ) {}

  async draftForCustomer(garageId: string, customerId: string): Promise<AiActionWithCustomer> {
    const draft = await this.ai.proposeAction(garageId, customerId);
    const expiresAt =
      draft.expiresAtDays != null
        ? new Date(Date.now() + draft.expiresAtDays * 24 * 60 * 60 * 1000)
        : null;

    return this.prisma.aiAction.create({
      data: {
        garageId,
        customerId,
        kind: draft.kind,
        status: 'DRAFT',
        messageBody: draft.messageBody,
        discountKind: draft.discountKind ?? null,
        discountValue: draft.discountValue ?? null,
        expiresAt,
        churnRiskSnapshot: draft.churnRiskSnapshot,
        factorsSnapshot: draft.factorsSnapshot,
      },
      include: ACTION_INCLUDE,
    });
  }

  async list(garageId: string, query: ListActionsDto): Promise<AiActionWithCustomer[]> {
    const where: Prisma.AiActionWhereInput = { garageId };
    if (query.customerId) where.customerId = query.customerId;
    if (query.status) where.status = query.status;
    return this.prisma.aiAction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: ACTION_INCLUDE,
    });
  }

  async findOne(garageId: string, id: string): Promise<AiActionWithCustomer> {
    const action = await this.prisma.aiAction.findFirst({
      where: { id, garageId },
      include: ACTION_INCLUDE,
    });
    if (!action) throw new NotFoundException('AI action not found');
    return action;
  }

  async approveAndSend(
    garageId: string,
    userId: string,
    id: string,
    edits: ApproveActionDto,
  ): Promise<AiActionWithCustomer> {
    const action = await this.findOne(garageId, id);
    if (action.status !== 'DRAFT') {
      throw new BadRequestException(`Cannot approve action in status ${action.status}`);
    }
    if (!action.customer.smsOptIn) {
      throw new ForbiddenException('Customer has opted out of SMS');
    }
    if (!action.customer.phone) {
      throw new BadRequestException('Customer has no phone number');
    }

    const messageBody = edits.messageBody ?? action.messageBody;
    const discountKind = edits.discountKind ?? action.discountKind;
    const discountValue = edits.discountValue ?? action.discountValue;
    const expiresAt = edits.expiresAt ? new Date(edits.expiresAt) : action.expiresAt;

    await this.prisma.aiAction.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedByUserId: userId,
        messageBody,
        discountKind,
        discountValue,
        expiresAt,
      },
    });

    try {
      const result = await this.sms.send(action.customer.phone, messageBody);
      return this.prisma.aiAction.update({
        where: { id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          providerMessageId: result.providerMessageId,
        },
        include: ACTION_INCLUDE,
      });
    } catch (err: any) {
      this.logger.error(`SMS send failed for action ${id}: ${err?.message || err}`);
      return this.prisma.aiAction.update({
        where: { id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          errorMessage: err?.message || String(err),
        },
        include: ACTION_INCLUDE,
      });
    }
  }

  async skip(garageId: string, id: string): Promise<AiActionWithCustomer> {
    const action = await this.findOne(garageId, id);
    if (action.status !== 'DRAFT') {
      throw new BadRequestException(`Cannot skip action in status ${action.status}`);
    }
    return this.prisma.aiAction.update({
      where: { id },
      data: { status: 'SKIPPED' },
      include: ACTION_INCLUDE,
    });
  }

  async markRedeemed(
    garageId: string,
    id: string,
    dto: RedeemActionDto,
  ): Promise<AiActionWithCustomer> {
    const action = await this.findOne(garageId, id);
    if (action.status !== 'SENT') {
      throw new BadRequestException(`Cannot redeem action in status ${action.status}`);
    }
    if (dto.invoiceId) {
      const invoice = await this.prisma.invoice.findFirst({
        where: { id: dto.invoiceId, garageId },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
    }
    return this.prisma.aiAction.update({
      where: { id },
      data: {
        status: 'REDEEMED',
        redeemedAt: new Date(),
        redeemedInvoiceId: dto.invoiceId ?? null,
      },
      include: ACTION_INCLUDE,
    });
  }

  async expireOverdue(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.aiAction.updateMany({
      where: { status: 'SENT', expiresAt: { lt: now } },
      data: { status: 'EXPIRED' },
    });
    return result.count;
  }
}
