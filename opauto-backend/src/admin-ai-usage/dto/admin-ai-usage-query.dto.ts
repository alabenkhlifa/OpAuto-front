import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum AiUsageRangeKey {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  LAST_WEEK = 'last_week',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
  THIS_QUARTER = 'this_quarter',
  LAST_QUARTER = 'last_quarter',
  THIS_YEAR = 'this_year',
  LAST_YEAR = 'last_year',
}

export class AdminAiUsageQueryDto {
  @ApiPropertyOptional({
    enum: AiUsageRangeKey,
    description: 'Range key to report over. Defaults to today.',
    required: false,
  })
  @IsEnum(AiUsageRangeKey, {
    message: `range must be one of: ${Object.values(AiUsageRangeKey).join(', ')}`,
  })
  range: AiUsageRangeKey = AiUsageRangeKey.TODAY;
}
