import { IsIn, IsOptional, IsString } from 'class-validator';

export class ApprovalDecisionDto {
  @IsIn(['approve', 'deny'])
  decision!: 'approve' | 'deny';

  @IsOptional()
  @IsString()
  typedConfirmation?: string;
}
