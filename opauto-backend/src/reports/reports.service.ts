import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats(garageId: string) {
    const [appointments, maintenanceJobs, invoices, customers] = await Promise.all([
      this.prisma.appointment.count({ where: { garageId } }),
      this.prisma.maintenanceJob.count({ where: { garageId, status: 'IN_PROGRESS' } }),
      this.prisma.invoice.aggregate({ where: { garageId, status: 'PAID' }, _sum: { total: true }, _count: true }),
      this.prisma.customer.count({ where: { garageId } }),
    ]);
    return {
      totalAppointments: appointments,
      activeJobs: maintenanceJobs,
      totalRevenue: invoices._sum.total || 0,
      paidInvoices: invoices._count,
      totalCustomers: customers,
    };
  }

  async getRevenueByMonth(garageId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: { garageId, status: 'PAID' },
      select: { total: true, paidAt: true },
      orderBy: { paidAt: 'asc' },
    });
    const monthly: Record<string, number> = {};
    invoices.forEach(inv => {
      if (inv.paidAt) {
        const key = `${inv.paidAt.getFullYear()}-${String(inv.paidAt.getMonth() + 1).padStart(2, '0')}`;
        monthly[key] = (monthly[key] || 0) + inv.total;
      }
    });
    return monthly;
  }
}
