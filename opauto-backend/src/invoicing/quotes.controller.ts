import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  ModuleAccessGuard,
  RequireModule,
} from '../modules/module-access.guard';

@ApiTags('quotes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleAccessGuard)
@Roles(UserRole.OWNER)
@Controller('quotes')
export class QuotesController {
  constructor(private service: QuotesService) {}

  @Get()
  findAll(@CurrentUser('garageId') gid: string) {
    return this.service.findAll(gid);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('garageId') gid: string) {
    return this.service.findOne(id, gid);
  }

  @Post()
  @RequireModule('invoicing')
  create(@CurrentUser('garageId') gid: string, @Body() dto: CreateQuoteDto) {
    return this.service.create(gid, dto);
  }

  @Put(':id')
  @RequireModule('invoicing')
  update(
    @Param('id') id: string,
    @CurrentUser('garageId') gid: string,
    @Body() dto: UpdateQuoteDto,
  ) {
    return this.service.update(id, gid, dto);
  }

  @Post(':id/send')
  @RequireModule('invoicing')
  send(@Param('id') id: string, @CurrentUser('garageId') gid: string) {
    return this.service.send(id, gid);
  }

  @Post(':id/approve')
  @RequireModule('invoicing')
  approve(@Param('id') id: string, @CurrentUser('garageId') gid: string) {
    return this.service.approve(id, gid);
  }

  @Post(':id/reject')
  @RequireModule('invoicing')
  reject(@Param('id') id: string, @CurrentUser('garageId') gid: string) {
    return this.service.reject(id, gid);
  }
}
