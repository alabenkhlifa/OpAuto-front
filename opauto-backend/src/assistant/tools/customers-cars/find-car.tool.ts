import { AssistantBlastTier } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AssistantUserContext,
  ToolDefinition,
} from '../../types';

export interface FindCarArgs {
  query: string;
}

export interface FindCarHit {
  id: string;
  displayName: string;
  customerId: string;
  customerName: string | null;
  make: string;
  model: string;
  year: number;
  plate: string;
  mileage: number | null;
}

const MAX_RESULTS = 5;

export function createFindCarTool(deps: {
  prisma: PrismaService;
}): ToolDefinition<FindCarArgs, FindCarHit[]> {
  return {
    name: 'find_car',
    description:
      'Fuzzy search cars in this garage by license plate, VIN, make, or model. Returns up to 5 matches with summary fields.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          minLength: 1,
          description: 'Search term (plate, VIN, make, or model).',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    blastTier: AssistantBlastTier.READ,
    handler: async (
      args: FindCarArgs,
      ctx: AssistantUserContext,
    ): Promise<FindCarHit[]> => {
      const q = args.query.trim();
      // Tenant isolation: garageId is always added to the WHERE clause.
      const cars = await deps.prisma.car.findMany({
        where: {
          garageId: ctx.garageId,
          OR: [
            { licensePlate: { contains: q, mode: 'insensitive' } },
            { vin: { contains: q, mode: 'insensitive' } },
            { make: { contains: q, mode: 'insensitive' } },
            { model: { contains: q, mode: 'insensitive' } },
          ],
        },
        include: {
          customer: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: MAX_RESULTS,
      });

      return cars.map((car) => {
        const customerName = car.customer
          ? `${car.customer.firstName ?? ''} ${car.customer.lastName ?? ''}`.trim() || null
          : null;
        const displayName = `${car.year} ${car.make} ${car.model} (${car.licensePlate})`;
        return {
          id: car.id,
          displayName,
          customerId: car.customerId,
          customerName,
          make: car.make,
          model: car.model,
          year: car.year,
          plate: car.licensePlate,
          mileage: car.mileage ?? null,
        };
      });
    },
  };
}
