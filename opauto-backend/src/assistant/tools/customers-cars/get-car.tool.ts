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
}

export interface GetCarError {
  error: 'not_found';
  message: string;
}

const RECENT_JOBS_LIMIT = 5;

export function createGetCarTool(deps: {
  carsService: CarsService;
}): ToolDefinition<GetCarArgs, GetCarResult | GetCarError> {
  return {
    name: 'get_car',
    description:
      'Get a single car by id, including up to 5 most recent maintenance jobs. Returns {error:"not_found"} if the car does not belong to this garage.',
    parameters: {
      type: 'object',
      properties: {
        carId: {
          type: 'string',
          minLength: 1,
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
            createdAt:
              job.createdAt instanceof Date
                ? job.createdAt.toISOString()
                : String(job.createdAt),
            completionDate: job.completionDate
              ? job.completionDate instanceof Date
                ? job.completionDate.toISOString()
                : String(job.completionDate)
              : null,
          }));

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
