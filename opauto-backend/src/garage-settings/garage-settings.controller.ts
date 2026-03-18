import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { GarageSettingsService } from './garage-settings.service';
import { UpdateGarageDto } from './dto/update-garage.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('garage-settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER)
@Controller('garage-settings')
export class GarageSettingsController {
  constructor(private service: GarageSettingsService) {}
  @Get() get(@CurrentUser('garageId') gid: string) { return this.service.getSettings(gid); }
  @Put() update(@CurrentUser('garageId') gid: string, @Body() dto: UpdateGarageDto) { return this.service.updateSettings(gid, dto); }
}
