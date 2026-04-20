import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { ModuleAccessGuard, RequireModule } from '../modules/module-access.guard';

@ApiTags('employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleAccessGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private service: EmployeesService) {}
  @Get() findAll(@CurrentUser('garageId') gid: string) { return this.service.findAll(gid); }
  @Get(':id') findOne(@Param('id') id: string, @CurrentUser('garageId') gid: string) { return this.service.findOne(id, gid); }
  @Post() @Roles(UserRole.OWNER) @RequireModule('employees') create(@CurrentUser('garageId') gid: string, @Body() dto: CreateEmployeeDto) { return this.service.create(gid, dto); }
  @Put(':id') @Roles(UserRole.OWNER) @RequireModule('employees') update(@Param('id') id: string, @CurrentUser('garageId') gid: string, @Body() dto: UpdateEmployeeDto) { return this.service.update(id, gid, dto); }
  @Delete(':id') @Roles(UserRole.OWNER) @RequireModule('employees') remove(@Param('id') id: string, @CurrentUser('garageId') gid: string) { return this.service.remove(id, gid); }
}
