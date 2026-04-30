import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { InvoicingService } from './invoicing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  ModuleAccessGuard,
  RequireModule,
} from '../modules/module-access.guard';

/**
 * Payments controller — split out of InvoicingController so payment
 * recording can be reasoned about (and authorised) independently of
 * invoice CRUD. Reuses `InvoicingService.addPayment()` so the business
 * rules around state transitions and totals stay in one place.
 *
 * The route shape stays `/invoices/:id/payments` to preserve the
 * existing public API contract (front-end + integration tests).
 */
@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleAccessGuard)
@Roles(UserRole.OWNER, UserRole.STAFF)
@Controller('invoices')
export class PaymentsController {
  constructor(private service: InvoicingService) {}

  @Post(':id/payments')
  @RequireModule('invoicing')
  addPayment(
    @Param('id') id: string,
    @CurrentUser('garageId') gid: string,
    @Body() dto: any,
  ) {
    return this.service.addPayment(id, gid, dto);
  }
}
