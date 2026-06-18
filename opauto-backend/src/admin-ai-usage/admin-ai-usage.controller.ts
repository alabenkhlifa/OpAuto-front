import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { AdminAiUsageService } from './admin-ai-usage.service';
import {
  AdminAiUsageQueryDto,
  AiUsageRangeKey,
} from './dto/admin-ai-usage-query.dto';

@ApiTags('admin-ai-usage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER)
@Controller()
export class AdminAiUsageController {
  constructor(private readonly service: AdminAiUsageService) {}

  @Get(['admin-ai-usage', 'admin/ai-usage'])
  @ApiQuery({ name: 'range', required: false, enum: AiUsageRangeKey })
  getUsage(
    @CurrentUser('garageId') garageId: string,
    @Query() query: AdminAiUsageQueryDto,
  ) {
    return this.service.getOvhUsage(
      garageId,
      query.range ?? AiUsageRangeKey.TODAY,
    );
  }
}
