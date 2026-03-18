import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InvoicingService } from './invoicing.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { ModuleAccessGuard, RequireModule } from '../modules/module-access.guard';

@ApiTags('invoicing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleAccessGuard)
@Roles(UserRole.OWNER)
@Controller('invoices')
export class InvoicingController {
  constructor(private service: InvoicingService) {}
  @Get() findAll(@CurrentUser('garageId') gid: string) { return this.service.findAll(gid); }
  @Get(':id') findOne(@Param('id') id: string, @CurrentUser('garageId') gid: string) { return this.service.findOne(id, gid); }
  @Post() @RequireModule('invoicing') create(@CurrentUser('garageId') gid: string, @Body() dto: CreateInvoiceDto) { return this.service.create(gid, dto); }
  @Put(':id') @RequireModule('invoicing') update(@Param('id') id: string, @CurrentUser('garageId') gid: string, @Body() dto: UpdateInvoiceDto) { return this.service.update(id, gid, dto); }
  @Delete(':id') @RequireModule('invoicing') remove(@Param('id') id: string, @CurrentUser('garageId') gid: string) { return this.service.remove(id, gid); }
}
