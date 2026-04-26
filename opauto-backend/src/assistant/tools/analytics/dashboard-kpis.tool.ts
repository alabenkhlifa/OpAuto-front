import { AssistantBlastTier } from '@prisma/client';
import { ReportsService } from '../../../reports/reports.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export interface DashboardKpisResult {
  totalAppointments: number;
  activeJobs: number;
  totalRevenue: number;
  paidInvoices: number;
  totalCustomers: number;
}

/**
 * Snapshot of the owner dashboard. No arguments — always reports for the
 * caller's own garage. Reuses ReportsService so the numbers are identical
 * to what the dashboard UI shows.
 */
export function buildGetDashboardKpisTool(
  reports: ReportsService,
): ToolDefinition<Record<string, never>, DashboardKpisResult> {
  return {
    name: 'get_dashboard_kpis',
    description:
      "Returns the owner's headline KPIs for their garage: total appointments, " +
      'active maintenance jobs, total paid revenue, count of paid invoices, and ' +
      'total customer count. Use when the user asks for a quick overview, ' +
      'dashboard summary, or "how is my garage doing".',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    blastTier: AssistantBlastTier.READ,
    requiredRole: 'OWNER',
    handler: async (
      _args: Record<string, never>,
      ctx: AssistantUserContext,
    ): Promise<DashboardKpisResult> => {
      return reports.getDashboardStats(ctx.garageId);
    },
  };
}
