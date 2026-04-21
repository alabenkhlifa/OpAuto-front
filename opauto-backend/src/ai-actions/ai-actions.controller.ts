import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AiActionsService } from './ai-actions.service';
import { ApproveActionDto } from './dto/approve-action.dto';
import { DraftActionDto } from './dto/draft-action.dto';
import { ListActionsDto } from './dto/list-actions.dto';
import { RedeemActionDto } from './dto/redeem-action.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('ai-actions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai/actions')
export class AiActionsController {
  constructor(private readonly service: AiActionsService) {}

  @Post('draft')
  draft(@CurrentUser('garageId') garageId: string, @Body() dto: DraftActionDto) {
    return this.service.draftForCustomer(garageId, dto.customerId);
  }

  @Get()
  list(@CurrentUser('garageId') garageId: string, @Query() query: ListActionsDto) {
    return this.service.list(garageId, query);
  }

  @Get(':id')
  findOne(@CurrentUser('garageId') garageId: string, @Param('id') id: string) {
    return this.service.findOne(garageId, id);
  }

  @Post(':id/approve')
  approve(
    @CurrentUser('garageId') garageId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: ApproveActionDto,
  ) {
    return this.service.approveAndSend(garageId, userId, id, dto);
  }

  @Post(':id/skip')
  skip(@CurrentUser('garageId') garageId: string, @Param('id') id: string) {
    return this.service.skip(garageId, id);
  }

  @Post(':id/redeem')
  redeem(
    @CurrentUser('garageId') garageId: string,
    @Param('id') id: string,
    @Body() dto: RedeemActionDto,
  ) {
    return this.service.markRedeemed(garageId, id, dto);
  }
}
