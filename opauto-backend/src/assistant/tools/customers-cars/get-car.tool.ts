import { AssistantBlastTier } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { CarsService } from '../../../cars/cars.service';
import {
  AssistantUserContext,
  ToolDefinition,
} from '../../types';

export interface GetCarArgs {
  carId: string;
}

export interface GetCarResult {
  id: string;
  customerId: string;
  customerName: string | null;
  make: string;
  model: string;
  year: number;
  vin: string | null;
  plate: string;
  color: string | null;
  mileage: number | null;
  engineType: string | null;
  transmission: string | null;
  lastServiceDate: string | null;
  nextServiceDate: string | null;
  notes: string | null;
  recentMaintenanceJobs: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
    completionDate: string | null;
  }>;
  recentServiceAppointments: Array<{
    id: string;
    title: string;
    status: string;
    type: string | null;
    startTime: string;
    endTime: string;
  }>;
  serviceHistory: Array<{
    source: 'maintenance_job' | 'appointment';
    id: string;
    title: string;
    status: string;
    type: string | null;
    date: string;
  }>;
}

export interface GetCarError {
  error: 'not_found';
  message: string;
}

const RECENT_JOBS_LIMIT = 5;
const RECENT_SERVICE_APPOINTMENTS_LIMIT = 5;
const SERVICE_HISTORY_LIMIT = 10;

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function nullableIso(value: unknown): string | null {
  return value ? toIso(value) : null;
}

export function createGetCarTool(deps: {
  carsService: CarsService;
}): ToolDefinition<GetCarArgs, GetCarResult | GetCarError> {
  return {
    name: 'get_car',
    description:
      'Get a single car by id, including up to 5 most recent maintenance jobs and completed service appointments. Completed appointments count as service history; do not say there is no completed work if recentServiceAppointments or serviceHistory is non-empty. Returns {error:"not_found"} if the car does not belong to this garage.',
    parameters: {
      type: 'object',
      properties: {
        carId: {
          type: 'string',
          format: 'uuid',
          description: 'Car id (uuid).',
        },
      },
      required: ['carId'],
      additionalProperties: false,
    },
    blastTier: AssistantBlastTier.READ,
    handler: async (
      args: GetCarArgs,
      ctx: AssistantUserContext,
    ): Promise<GetCarResult | GetCarError> => {
      try {
        // CarsService.findOne enforces garage scope; foreign-garage id throws.
        const car: any = await deps.carsService.findOne(
          args.carId,
          ctx.garageId,
        );

        const customerName = car.customer
          ? `${car.customer.firstName ?? ''} ${car.customer.lastName ?? ''}`.trim() || null
          : null;

        const recentMaintenanceJobs = (car.maintenanceJobs ?? [])
          .slice(0, RECENT_JOBS_LIMIT)
          .map((job: any) => ({
            id: job.id,
            title: job.title,
            status: job.status,
            createdAt: toIso(job.createdAt),
            completionDate: nullableIso(job.completionDate),
          }));

        const recentServiceAppointments = (car.appointments ?? [])
          .filter((appointment: any) => appointment.status === 'COMPLETED')
          .slice(0, RECENT_SERVICE_APPOINTMENTS_LIMIT)
          .map((appointment: any) => ({
            id: appointment.id,
            title: appointment.title,
            status: appointment.status,
            type: appointment.type ?? null,
            startTime: toIso(appointment.startTime),
            endTime: toIso(appointment.endTime),
          }));

        const serviceHistory = [
          ...recentMaintenanceJobs.map((job) => ({
            source: 'maintenance_job' as const,
            id: job.id,
            title: job.title,
            status: job.status,
            type: null,
            date: job.completionDate ?? job.createdAt,
          })),
          ...recentServiceAppointments.map((appointment) => ({
            source: 'appointment' as const,
            id: appointment.id,
            title: appointment.title,
            status: appointment.status,
            type: appointment.type,
            date: appointment.endTime,
          })),
        ]
          .sort(
            (a, b) =>
              new Date(b.date).getTime() - new Date(a.date).getTime(),
          )
          .slice(0, SERVICE_HISTORY_LIMIT);

        return {
          id: car.id,
          customerId: car.customerId,
          customerName,
          make: car.make,
          model: car.model,
          year: car.year,
          vin: car.vin ?? null,
          plate: car.licensePlate,
          color: car.color ?? null,
          mileage: car.mileage ?? null,
          engineType: car.engineType ?? null,
          transmission: car.transmission ?? null,
          lastServiceDate: car.lastServiceDate
            ? car.lastServiceDate instanceof Date
              ? car.lastServiceDate.toISOString()
              : String(car.lastServiceDate)
            : null,
          nextServiceDate: car.nextServiceDate
            ? car.nextServiceDate instanceof Date
              ? car.nextServiceDate.toISOString()
              : String(car.nextServiceDate)
            : null,
          notes: car.notes ?? null,
          recentMaintenanceJobs,
          recentServiceAppointments,
          serviceHistory,
        };
      } catch (err) {
        if (err instanceof NotFoundException) {
          return {
            error: 'not_found',
            message: `Car ${args.carId} not found in this garage.`,
          };
        }
        throw err;
      }
    },
  };
}
