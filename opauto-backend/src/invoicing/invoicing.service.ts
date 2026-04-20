import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

@Injectable()
export class InvoicingService {
  constructor(private prisma: PrismaService) {}

  private generateInvoiceNumber(): string {
    const now = new Date();
    return `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
  }

  async findAll(garageId: string) {
    return this.prisma.invoice.findMany({
      where: { garageId },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        car: { select: { make: true, model: true, year: true, licensePlate: true } },
        payments: { select: { id: true, amount: true, method: true, paidAt: true, reference: true } },
        _count: { select: { lineItems: true, payments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, garageId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, garageId },
      include: { customer: true, car: true, lineItems: true, payments: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async create(garageId: string, dto: CreateInvoiceDto) {
    const garage = await this.prisma.garage.findUnique({ where: { id: garageId } });
    const taxRate = garage?.taxRate || 19;
    const lineItems = dto.lineItems.map(item => ({ ...item, total: item.quantity * item.unitPrice }));
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const discount = dto.discount || 0;
    const taxAmount = (subtotal - discount) * (taxRate / 100);
    const total = subtotal - discount + taxAmount;

    return this.prisma.invoice.create({
      data: {
        garageId, customerId: dto.customerId,
        carId: dto.carId,
        invoiceNumber: this.generateInvoiceNumber(),
        subtotal, taxAmount, discount, total,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        notes: dto.notes,
        lineItems: { create: lineItems },
      },
      include: { lineItems: true, customer: true, car: true },
    });
  }

  async update(id: string, garageId: string, dto: UpdateInvoiceDto) {
    await this.findOne(id, garageId);
    return this.prisma.invoice.update({ where: { id }, data: { status: dto.status, notes: dto.notes } });
  }

  async remove(id: string, garageId: string) {
    await this.findOne(id, garageId);
    return this.prisma.invoice.delete({ where: { id } });
  }

  async addPayment(invoiceId: string, garageId: string, dto: { amount: number; method?: string; paymentDate?: string; reference?: string; notes?: string; processedBy?: string }) {
    const invoice = await this.findOne(invoiceId, garageId);
    const payment = await this.prisma.payment.create({
      data: {
        invoiceId,
        amount: dto.amount,
        method: (dto.method as any) || 'CASH',
        reference: dto.reference,
        paidAt: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
      },
    });

    const payments = await this.prisma.payment.findMany({ where: { invoiceId } });
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const newStatus = totalPaid >= invoice.total ? 'PAID' : 'PARTIALLY_PAID';
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: newStatus, paidAt: newStatus === 'PAID' ? payment.paidAt : null },
    });

    return payment;
  }
}
