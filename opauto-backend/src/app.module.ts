import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AssistantThrottlerGuard } from './assistant/assistant-throttler.guard';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CustomersModule } from './customers/customers.module';
import { CarsModule } from './cars/cars.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { InvoicingModule } from './invoicing/invoicing.module';
import { InventoryModule } from './inventory/inventory.module';
import { ServicesCatalogModule } from './services-catalog/services-catalog.module';
import { EmployeesModule } from './employees/employees.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ModulesModule } from './modules/modules.module';
import { GarageSettingsModule } from './garage-settings/garage-settings.module';
import { AiModule } from './ai/ai.module';
import { AiActionsModule } from './ai-actions/ai-actions.module';
import { SmsModule } from './sms/sms.module';
import { EmailModule } from './email/email.module';
import { AssistantModule } from './assistant/assistant.module';
import { AnalyticsToolsModule } from './assistant/tools/analytics/analytics-tools.module';
import { CustomersCarsToolsModule } from './assistant/tools/customers-cars/customers-cars-tools.module';
import { AppointmentsToolsModule } from './assistant/tools/appointments/appointments-tools.module';
import { InvoicingInventoryToolsModule } from './assistant/tools/invoicing-inventory/invoicing-inventory-tools.module';
import { CommunicationsToolsModule } from './assistant/tools/communications/communications-tools.module';
import { ReportsToolsModule } from './assistant/tools/reports/reports-tools.module';
import { AgentsModule } from './assistant/agents/agents.module';
import { PublicModule } from './public/public.module';

// Per-throttler trackers: `short` keys on userId, `long` keys on garageId.
// Both fall back to the request IP for any unauthenticated entry-point so the
// guard never crashes when CurrentUser is missing (e.g. health checks).
const userIdTracker = (req: Record<string, any>): string => {
  const user = req.user;
  return user?.userId ?? user?.id ?? req.ip ?? 'anon';
};
const garageIdTracker = (req: Record<string, any>): string => {
  const user = req.user;
  return user?.garageId ?? req.ip ?? 'anon';
};

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Default in-memory ThrottlerStorage is per-instance, so on a multi-
    // instance deploy each pod gets its own bucket and effective ceilings
    // are `instances × limit`. To switch to Redis-backed storage when you
    // scale, install `@nest-lab/throttler-storage-redis` (or equivalent)
    // and replace this with:
    //   ThrottlerModule.forRootAsync({
    //     inject: [ConfigService],
    //     useFactory: (config) => ({
    //       throttlers: [...same as below...],
    //       storage: new ThrottlerStorageRedisService(config.get('REDIS_URL')),
    //     }),
    //   })
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'short', limit: 30, ttl: 60_000, getTracker: userIdTracker },
        { name: 'long', limit: 200, ttl: 60_000, getTracker: garageIdTracker },
      ],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    CarsModule,
    AppointmentsModule,
    MaintenanceModule,
    InvoicingModule,
    InventoryModule,
    ServicesCatalogModule,
    EmployeesModule,
    ApprovalsModule,
    ReportsModule,
    NotificationsModule,
    ModulesModule,
    GarageSettingsModule,
    AiModule,
    SmsModule,
    EmailModule,
    AiActionsModule,
    AssistantModule,
    AnalyticsToolsModule,
    CustomersCarsToolsModule,
    AppointmentsToolsModule,
    InvoicingInventoryToolsModule,
    CommunicationsToolsModule,
    ReportsToolsModule,
    AgentsModule,
    PublicModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AssistantThrottlerGuard },
  ],
})
export class AppModule {}
