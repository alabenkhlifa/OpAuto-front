import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { GarageSettingsService } from './garage-settings.service';
import { UpdateGarageDto } from './dto/update-garage.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

/**
 * BUG-108 (Sweep C-16) — split read vs write at the route level so STAFF
 * can read the fiscal config (default TVA, fiscal stamp threshold, RIB / MF)
 * needed to render an invoice correctly. Mirrors the invoicing controller's
 * pattern: `@Roles(OWNER, STAFF)` on reads, `@Roles(OWNER)` only on writes.
 */
@ApiTags('garage-settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('garage-settings')
export class GarageSettingsController {
  constructor(private service: GarageSettingsService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.STAFF)
  get(@CurrentUser('garageId') gid: string) {
    return this.service.getSettings(gid);
  }

  @Put()
  @Roles(UserRole.OWNER)
  update(@CurrentUser('garageId') gid: string, @Body() dto: UpdateGarageDto) {
    return this.service.updateSettings(gid, dto);
  }
}
