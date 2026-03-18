import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ModuleAccessGuard, RequireModule } from '../modules/module-access.guard';

@ApiTags('maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
@Controller('maintenance')
export class MaintenanceController {
  constructor(private service: MaintenanceService) {}

  @Get() findAll(@CurrentUser('garageId') gid: string) { return this.service.findAll(gid); }
  @Get(':id') findOne(@Param('id') id: string, @CurrentUser('garageId') gid: string) { return this.service.findOne(id, gid); }
  @Post() @RequireModule('maintenance') create(@CurrentUser('garageId') gid: string, @Body() dto: CreateMaintenanceDto) { return this.service.create(gid, dto); }
  @Put(':id') @RequireModule('maintenance') update(@Param('id') id: string, @CurrentUser('garageId') gid: string, @Body() dto: UpdateMaintenanceDto) { return this.service.update(id, gid, dto); }
  @Delete(':id') @RequireModule('maintenance') remove(@Param('id') id: string, @CurrentUser('garageId') gid: string) { return this.service.remove(id, gid); }
}
