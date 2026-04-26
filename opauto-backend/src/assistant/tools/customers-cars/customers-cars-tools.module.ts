import { Module } from '@nestjs/common';
import { AssistantModule } from '../../assistant.module';
import { PrismaModule } from '../../../prisma/prisma.module';
import { CustomersModule } from '../../../customers/customers.module';
import { CarsModule } from '../../../cars/cars.module';
import { AiModule } from '../../../ai/ai.module';
import { CustomersCarsToolsRegistrar } from './customers-cars-tools.registrar';

@Module({
  imports: [AssistantModule, PrismaModule, CustomersModule, CarsModule, AiModule],
  providers: [CustomersCarsToolsRegistrar],
})
export class CustomersCarsToolsModule {}
