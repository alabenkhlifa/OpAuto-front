import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MODULE_CATALOG = [
  { id: 'dashboard', name: 'Dashboard', price: 0, description: 'Overview and KPIs' },
  { id: 'customers', name: 'Customers', price: 0, description: 'Customer management' },
  { id: 'cars', name: 'Cars', price: 0, description: 'Vehicle registry' },
  { id: 'appointments', name: 'Appointments', price: 0, description: 'Basic scheduling' },
  { id: 'calendar', name: 'Calendar', price: 0, description: 'Advanced calendar with drag-drop' },
  { id: 'maintenance', name: 'Maintenance', price: 39, description: 'Job tracking and workflows' },
  { id: 'invoicing', name: 'Invoicing', price: 29, description: 'Invoice and payment management' },
  { id: 'inventory', name: 'Inventory', price: 29, description: 'Parts and stock management' },
  { id: 'employees', name: 'Employees', price: 19, description: 'Staff management' },
  { id: 'reports', name: 'Reports', price: 39, description: 'Analytics and reporting' },
  { id: 'approvals', name: 'Approvals', price: 19, description: 'Approval workflows' },
  { id: 'users', name: 'User Management', price: 19, description: 'Multi-user access' },
  { id: 'settings', name: 'Advanced Settings', price: 9, description: 'Garage configuration' },
  { id: 'ai', name: 'AI Features', price: 49, description: 'AI-powered insights' },
  { id: 'notifications', name: 'Notifications', price: 19, description: 'Smart notifications' },
];

const FREE_MODULES = ['dashboard', 'customers', 'cars', 'appointments', 'calendar'];

@Injectable()
export class ModulesService {
  constructor(private prisma: PrismaService) {}

  getCatalog() { return MODULE_CATALOG; }

  async getActiveModules(garageId: string) {
    const modules = await this.prisma.garageModule.findMany({
      where: { garageId },
    });
    // Access lasts until expiresAt, even if cancelled (isActive=false means won't renew)
    const now = new Date();
    return modules.filter(m => !m.expiresAt || m.expiresAt > now);
  }

  async hasAccess(garageId: string, moduleId: string) {
    if (FREE_MODULES.includes(moduleId)) return true;
    const mod = await this.prisma.garageModule.findUnique({
      where: { garageId_moduleId: { garageId, moduleId } },
    });
    if (!mod) return false;
    // isActive=false means cancelled (won't renew), but access stays until expiry
    if (mod.expiresAt && mod.expiresAt < new Date()) return false;
    return true;
  }

  async purchaseModule(garageId: string, moduleId: string) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
    return this.prisma.garageModule.upsert({
      where: { garageId_moduleId: { garageId, moduleId } },
      update: { isActive: true, purchasedAt: now, expiresAt },
      create: { garageId, moduleId, purchasedAt: now, expiresAt },
    });
  }

  async deactivateModule(garageId: string, moduleId: string) {
    return this.prisma.garageModule.update({
      where: { garageId_moduleId: { garageId, moduleId } },
      data: { isActive: false },
    });
  }
}
