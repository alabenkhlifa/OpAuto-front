import { Controller, Get, Post, Delete, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ModulesService } from './modules.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('modules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('modules')
export class ModulesController {
  constructor(private service: ModulesService) {}
  @Get('catalog') getCatalog() { return this.service.getCatalog(); }
  @Get() getActive(@CurrentUser('garageId') gid: string) { return this.service.getActiveModules(gid); }
  @Get(':moduleId/access') hasAccess(@CurrentUser('garageId') gid: string, @Param('moduleId') mid: string) { return this.service.hasAccess(gid, mid); }
  @Post(':moduleId/purchase') @UseGuards(RolesGuard) @Roles(UserRole.OWNER)
  purchase(@CurrentUser('garageId') gid: string, @Param('moduleId') mid: string) { return this.service.purchaseModule(gid, mid); }
  @Delete(':moduleId') @UseGuards(RolesGuard) @Roles(UserRole.OWNER)
  deactivate(@CurrentUser('garageId') gid: string, @Param('moduleId') mid: string) { return this.service.deactivateModule(gid, mid); }
}
