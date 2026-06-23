import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import {
  ADMIN_AI_USAGE_OWNER_EMAIL,
  AdminAiUsageService,
} from './admin-ai-usage.service';
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

  private isAuthorizedOwnerEmail(email: string | null | undefined): boolean {
    return (
      typeof email === 'string' &&
      email.trim().toLowerCase() === ADMIN_AI_USAGE_OWNER_EMAIL
    );
  }

  @Get(['admin-ai-usage', 'admin/ai-usage'])
  @ApiQuery({ name: 'range', required: false, enum: AiUsageRangeKey })
  getUsage(
    @CurrentUser('email') email: string,
    @CurrentUser('garageId') garageId: string,
    @Query() query: AdminAiUsageQueryDto,
  ) {
    if (!this.isAuthorizedOwnerEmail(email)) {
      throw new ForbiddenException('Forbidden');
    }

    return this.service.getOvhUsage(
      garageId,
      query.range ?? AiUsageRangeKey.TODAY,
    );
  }
}

@ApiTags('admin-ai-usage')
@Controller()
export class AdminAiUsageCopyController {
  constructor(private readonly service: AdminAiUsageService) {}

  @Get(['admin-ai-usage/copy', 'admin/ai-usage/copy'])
  getCopy() {
    return this.service.getDashboardCopy();
  }
}
