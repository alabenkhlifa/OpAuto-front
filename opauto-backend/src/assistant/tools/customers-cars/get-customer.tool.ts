import { AssistantBlastTier } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { CustomersService } from '../../../customers/customers.service';
import {
  AssistantUserContext,
  ToolDefinition,
} from '../../types';

export interface GetCustomerArgs {
  customerId: string;
}

export interface GetCustomerResult {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string | null;
  phone: string;
  address: string | null;
  status: string;
  loyaltyTier: string | null;
  totalSpent: number;
  visitCount: number;
  smsOptIn: boolean;
  notes: string | null;
  createdAt: string;
  cars: Array<{
    id: string;
    make: string;
    model: string;
    year: number;
    licensePlate: string;
    mileage: number | null;
  }>;
  recentServiceAppointments: Array<{
    id: string;
    title: string;
    status: string;
    type: string | null;
    startTime: string;
    endTime: string;
    carId: string;
    carLabel: string;
  }>;
  recentInvoices: Array<{
    id: string;
    total: number;
    status: string;
    createdAt: string;
    paidAt: string | null;
  }>;
}

export interface GetCustomerError {
  error: 'not_found';
  message: string;
}

const RECENT_INVOICE_LIMIT = 5;
const RECENT_CAR_LIMIT = 5;
const RECENT_SERVICE_APPOINTMENT_LIMIT = 5;

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function carLabel(car: {
  make?: string | null;
  model?: string | null;
  licensePlate?: string | null;
}): string {
  return `${car.make ?? ''} ${car.model ?? ''}${car.licensePlate ? ` - ${car.licensePlate}` : ''}`.trim();
}

export function createGetCustomerTool(deps: {
  customersService: CustomersService;
}): ToolDefinition<GetCustomerArgs, GetCustomerResult | GetCustomerError> {
  return {
    name: 'get_customer',
    description:
      'Get a single customer by id, including up to 5 most recent cars, completed service appointments, and invoices. Completed appointments count as service history; use recentServiceAppointments for completed maintenance/service questions before looking at invoices. Returns {error:"not_found"} if the customer does not belong to this garage.',
    parameters: {
      type: 'object',
      properties: {
        customerId: {
          type: 'string',
          format: 'uuid',
          description: 'Customer id (uuid).',
        },
      },
      required: ['customerId'],
      additionalProperties: false,
    },
    blastTier: AssistantBlastTier.READ,
    handler: async (
      args: GetCustomerArgs,
      ctx: AssistantUserContext,
    ): Promise<GetCustomerResult | GetCustomerError> => {
      try {
        // CustomersService.findOne enforces garage scope and throws NotFound
        // when the id belongs to another tenant — we map that to a structured
        // error so the orchestrator can let the LLM self-correct.
        const customer: any = await deps.customersService.findOne(
          args.customerId,
          ctx.garageId,
        );

        const cars = (customer.cars ?? [])
          .slice(0, RECENT_CAR_LIMIT)
          .map((car: any) => ({
            id: car.id,
            make: car.make,
            model: car.model,
            year: car.year,
            licensePlate: car.licensePlate,
            mileage: car.mileage ?? null,
          }));
        const carsById = new Map(
          (customer.cars ?? []).map((car: any) => [car.id, car]),
        );

        const recentServiceAppointments = (customer.appointments ?? [])
          .filter((appointment: any) => appointment.status === 'COMPLETED')
          .slice(0, RECENT_SERVICE_APPOINTMENT_LIMIT)
          .map((appointment: any) => {
            const car = carsById.get(appointment.carId) as
              | {
                  make?: string | null;
                  model?: string | null;
                  licensePlate?: string | null;
                }
              | undefined;
            return {
              id: appointment.id,
              title: appointment.title,
              status: appointment.status,
              type: appointment.type ?? null,
              startTime: toIso(appointment.startTime),
              endTime: toIso(appointment.endTime),
              carId: appointment.carId,
              carLabel: car ? carLabel(car) : '',
            };
          });

        const recentInvoices = (customer.invoices ?? [])
          .slice(0, RECENT_INVOICE_LIMIT)
          .map((inv: any) => ({
            id: inv.id,
            total: inv.total,
            status: inv.status,
            createdAt: toIso(inv.createdAt),
            paidAt: inv.paidAt ? toIso(inv.paidAt) : null,
          }));

        return {
          id: customer.id,
          firstName: customer.firstName,
          lastName: customer.lastName,
          displayName: `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim(),
          email: customer.email ?? null,
          phone: customer.phone,
          address: customer.address ?? null,
          status: customer.status,
          loyaltyTier: customer.loyaltyTier ?? null,
          totalSpent: customer.totalSpent ?? 0,
          visitCount: customer.visitCount ?? 0,
          smsOptIn: customer.smsOptIn ?? true,
          notes: customer.notes ?? null,
          createdAt:
            customer.createdAt instanceof Date
              ? customer.createdAt.toISOString()
              : String(customer.createdAt),
          cars,
          recentServiceAppointments,
          recentInvoices,
        };
      } catch (err) {
        if (err instanceof NotFoundException) {
          return {
            error: 'not_found',
            message: `Customer ${args.customerId} not found in this garage.`,
          };
        }
        throw err;
      }
    },
  };
}
