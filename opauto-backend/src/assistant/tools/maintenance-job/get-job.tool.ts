import { AssistantBlastTier } from '@prisma/client';
import { MaintenanceService } from '../../../maintenance/maintenance.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export interface GetJobArgs {
  jobId: string;
}

export interface GetJobPartItem {
  id: string;
  type: string;
  description: string;
  quantity: number;
  unitPrice: number;
  partId?: string | null;
  partName?: string | null;
  partNumber?: string | null;
  serviceCode?: string | null;
  mechanicId?: string | null;
  mechanicName?: string | null;
  laborHours?: number | null;
  tvaRate: number;
  discountPct?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface GetJobApprovalRequestItem {
  id: string;
  status: string;
  requestedAmount?: number | null;
  summary?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  requestedBy?: string | null;
  responseChannel?: string | null;
  responseNote?: string | null;
  respondedBy?: string | null;
  respondedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GetJobApprovalItem {
  id: string;
  status: string;
  requestedAmount?: number | null;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GetJobTimelineItem {
  id: string;
  eventType: string;
  actorUserId?: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface GetJobResult {
  jobId: string;
  title: string;
  status: string;
  car?: {
    id: string;
    make: string;
    model: string;
    year: number;
    licensePlate: string;
    customerId: string;
    customerName: string;
  };
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  appointment?: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
  };
  counts: {
    taskCount: number;
    photoCount: number;
    partCount: number;
  };
  approvals: GetJobApprovalItem[];
  approvalRequests: GetJobApprovalRequestItem[];
  parts: GetJobPartItem[];
  timelineEvents: GetJobTimelineItem[];
  createdAt: string;
  updatedAt: string;
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  return '';
}

function toString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function toNum(v: unknown): number | null {
  return typeof v === 'number' ? v : null;
}

function toNumOrZero(v: unknown): number {
  return typeof v === 'number' ? v : 0;
}

function toNullableString(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v : null;
}

function mapPart(line: any): GetJobPartItem {
  const mech = line?.mechanic;
  const part = line?.part;
  return {
    id: toString(line?.id),
    type: toString(line?.type),
    description: toString(line?.description),
    quantity: toNumOrZero(line?.quantity),
    unitPrice: toNumOrZero(line?.unitPrice),
    partId: toNullableString(line?.partId),
    partName: toNullableString(part?.name),
    partNumber: toNullableString(part?.partNumber),
    serviceCode: toNullableString(line?.serviceCode),
    mechanicId: toNullableString(line?.mechanicId),
    mechanicName: toNullableString(mech ? `${mech.firstName} ${mech.lastName}`.trim() : ''),
    laborHours: toNum(line?.laborHours),
    tvaRate: toNumOrZero(line?.tvaRate),
    discountPct: toNum(line?.discountPct),
    createdAt: toIso(line?.createdAt),
    updatedAt: toIso(line?.updatedAt),
  };
}

function mapApproval(line: any): GetJobApprovalItem {
  return {
    id: toString(line?.id),
    status: toString(line?.status),
    requestedAmount: toNum(line?.requestedAmount),
    description: toNullableString(line?.description),
    createdAt: toIso(line?.createdAt),
    updatedAt: toIso(line?.updatedAt),
  };
}

function mapApprovalRequest(row: any): GetJobApprovalRequestItem {
  return {
    id: toString(row?.id),
    status: toString(row?.status),
    requestedAmount: toNum(row?.requestedAmount),
    summary: toNullableString(row?.summary),
    customerName: toNullableString(row?.customerName),
    customerEmail: toNullableString(row?.customerEmail),
    customerPhone: toNullableString(row?.customerPhone),
    requestedBy: toNullableString(row?.requestedBy),
    responseChannel: toNullableString(row?.responseChannel),
    responseNote: toNullableString(row?.responseNote),
    respondedBy: toNullableString(row?.respondedBy),
    respondedAt: toNullableString(row?.respondedAt),
    createdAt: toIso(row?.createdAt),
    updatedAt: toIso(row?.updatedAt),
  };
}

function mapTimeline(row: any): GetJobTimelineItem {
  return {
    id: toString(row?.id),
    eventType: toString(row?.eventType),
    actorUserId: toNullableString(row?.actorUserId),
    details: (row?.details as Record<string, unknown>) ?? null,
    createdAt: toIso(row?.createdAt),
  };
}

function mapJob(job: any): GetJobResult {
  const car = job?.car;
  const customer = car?.customer;
  const appointment = job?.appointment;
  const employee = job?.employee;

  return {
    jobId: toString(job?.id),
    title: toString(job?.title),
    status: toString(job?.status),
    car: car
      ? {
          id: toString(car.id),
          make: toString(car.make),
          model: toString(car.model),
          year: toNumOrZero(car.year),
          licensePlate: toString(car.licensePlate),
          customerId: toString(car.customer?.id),
          customerName: `${toString(customer?.firstName)} ${toString(customer?.lastName)}`.trim(),
        }
      : undefined,
    employee: employee
      ? {
          id: toString(employee.id),
          firstName: toString(employee.firstName),
          lastName: toString(employee.lastName),
        }
      : undefined,
    appointment: appointment
      ? {
          id: toString(appointment.id),
          title: toString(appointment.title),
          startTime: toIso(appointment.startTime),
          endTime: toIso(appointment.endTime),
        }
      : undefined,
    counts: {
      taskCount: Array.isArray(job?.tasks) ? job.tasks.length : 0,
      photoCount: Array.isArray(job?.photos) ? job.photos.length : 0,
      partCount: Array.isArray(job?.parts) ? job.parts.length : 0,
    },
    approvals: Array.isArray(job?.approvals)
      ? job.approvals.map(mapApproval)
      : [],
    approvalRequests: Array.isArray(job?.approvalRequests)
      ? job.approvalRequests.map(mapApprovalRequest)
      : [],
    parts: Array.isArray(job?.parts) ? job.parts.map(mapPart) : [],
    timelineEvents: Array.isArray(job?.timelineEvents)
      ? job.timelineEvents.map(mapTimeline)
      : [],
    createdAt: toIso(job?.createdAt),
    updatedAt: toIso(job?.updatedAt),
  };
}

export function buildGetJobTool(
  maintenanceService: MaintenanceService,
): ToolDefinition<GetJobArgs, GetJobResult> {
  return {
    name: 'get_job',
    description:
      'Load one maintenance job with durable lines/parts, approvals, and timeline history in one call. ' +
      'Use this as the first step for approval or job-invoice workflows.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['jobId'],
      properties: {
        jobId: {
          type: 'string',
          format: 'uuid',
          description: 'Maintenance job id (uuid).',
        },
      },
    },
    blastTier: AssistantBlastTier.READ,
    requiredRole: 'OWNER',
    requiredModule: 'maintenance',
    handler: async (args: GetJobArgs, ctx: AssistantUserContext): Promise<GetJobResult> => {
      const job = await maintenanceService.findOne(args.jobId, ctx.garageId);
      return mapJob(job);
    },
  };
}
