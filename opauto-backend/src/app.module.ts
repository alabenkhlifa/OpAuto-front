import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CustomersModule } from './customers/customers.module';
import { CarsModule } from './cars/cars.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { InvoicingModule } from './invoicing/invoicing.module';
import { InventoryModule } from './inventory/inventory.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    CarsModule,
    AppointmentsModule,
    MaintenanceModule,
    InvoicingModule,
    InventoryModule,
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
  ],
})
export class AppModule {}
