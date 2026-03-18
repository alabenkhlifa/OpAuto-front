import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ApprovalsService } from './approvals.service';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { RespondApprovalDto } from './dto/respond-approval.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('approvals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('approvals')
export class ApprovalsController {
  constructor(private service: ApprovalsService) {}
  @Get() findAll(@CurrentUser('garageId') gid: string) { return this.service.findAll(gid); }
  @Get(':id') findOne(@Param('id') id: string, @CurrentUser('garageId') gid: string) { return this.service.findOne(id, gid); }
  @Post() create(@CurrentUser('garageId') gid: string, @CurrentUser('id') uid: string, @Body() dto: CreateApprovalDto) { return this.service.create(gid, uid, dto); }
  @Put(':id/respond') @UseGuards(RolesGuard) @Roles(UserRole.OWNER)
  respond(@Param('id') id: string, @CurrentUser('garageId') gid: string, @CurrentUser('id') uid: string, @Body() dto: RespondApprovalDto) { return this.service.respond(id, gid, uid, dto); }
}
