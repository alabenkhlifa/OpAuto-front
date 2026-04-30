import { IsDateString, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Body for `POST /invoices/from-job/:jobId`. All fields are optional —
 * the service derives line items from the job's stock movements +
 * mechanic. The caller may override the due date and add notes.
 */
export class CreateFromJobDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
