import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { ModuleAccessGuard, RequireModule } from '../modules/module-access.guard';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleAccessGuard)
@Roles(UserRole.OWNER)
@RequireModule('reports')
@Controller('reports')
export class ReportsController {
  constructor(private service: ReportsService) {}
  @Get('dashboard') getDashboardStats(@CurrentUser('garageId') gid: string) { return this.service.getDashboardStats(gid); }
  @Get('revenue') getRevenueByMonth(@CurrentUser('garageId') gid: string) { return this.service.getRevenueByMonth(gid); }
}
