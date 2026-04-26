import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ToolRegistryService } from '../../tool-registry.service';
import { CustomersService } from '../../../customers/customers.service';
import { CarsService } from '../../../cars/cars.service';
import { AiService } from '../../../ai/ai.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { createFindCustomerTool } from './find-customer.tool';
import { createGetCustomerTool } from './get-customer.tool';
import { createListAtRiskCustomersTool } from './list-at-risk-customers.tool';
import { createListTopCustomersTool } from './list-top-customers.tool';
import { createFindCarTool } from './find-car.tool';
import { createGetCarTool } from './get-car.tool';
import { createListMaintenanceDueTool } from './list-maintenance-due.tool';

@Injectable()
export class CustomersCarsToolsRegistrar implements OnModuleInit {
  private readonly logger = new Logger(CustomersCarsToolsRegistrar.name);

  constructor(
    private readonly toolRegistry: ToolRegistryService,
    private readonly customersService: CustomersService,
    private readonly carsService: CarsService,
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.toolRegistry.register(
      createFindCustomerTool({ customersService: this.customersService }),
    );
    this.toolRegistry.register(
      createGetCustomerTool({ customersService: this.customersService }),
    );
    this.toolRegistry.register(
      createListAtRiskCustomersTool({ aiService: this.aiService }),
    );
    this.toolRegistry.register(
      createListTopCustomersTool({ prisma: this.prisma }),
    );
    this.toolRegistry.register(createFindCarTool({ prisma: this.prisma }));
    this.toolRegistry.register(
      createGetCarTool({ carsService: this.carsService }),
    );
    this.toolRegistry.register(
      createListMaintenanceDueTool({ aiService: this.aiService }),
    );
    this.logger.log(
      'Registered customers + cars tools: find_customer, get_customer, list_at_risk_customers, list_top_customers, find_car, get_car, list_maintenance_due',
    );
  }
}
