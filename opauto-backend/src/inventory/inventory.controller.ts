import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreatePartDto } from './dto/create-part.dto';
import { UpdatePartDto } from './dto/update-part.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { ModuleAccessGuard, RequireModule } from '../modules/module-access.guard';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleAccessGuard)
@Roles(UserRole.OWNER)
@Controller('inventory')
export class InventoryController {
  constructor(private service: InventoryService) {}
  @Get() findAll(
    @CurrentUser('garageId') gid: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit !== undefined && limit !== '' ? Number(limit) : undefined;
    return this.service.findAll(gid, search, parsedLimit);
  }
  @Get('suppliers') listSuppliers(@CurrentUser('garageId') gid: string) { return this.service.findSuppliers(gid); }
  @Get(':id') findOne(@Param('id') id: string, @CurrentUser('garageId') gid: string) { return this.service.findOne(id, gid); }
  @Post() @RequireModule('inventory') create(@CurrentUser('garageId') gid: string, @Body() dto: CreatePartDto) { return this.service.create(gid, dto); }
  @Put(':id') @RequireModule('inventory') update(@Param('id') id: string, @CurrentUser('garageId') gid: string, @Body() dto: UpdatePartDto) { return this.service.update(id, gid, dto); }
  @Post(':id/adjust') @RequireModule('inventory') adjust(
    @Param('id') id: string,
    @CurrentUser('garageId') gid: string,
    @Body() dto: { quantity: number; type: 'in' | 'out' | 'adjustment'; reason?: string; reference?: string },
  ) { return this.service.adjustStock(id, gid, dto.quantity, dto.type, dto.reason, dto.reference); }
  @Delete(':id') @RequireModule('inventory') remove(@Param('id') id: string, @CurrentUser('garageId') gid: string) { return this.service.remove(id, gid); }
}
