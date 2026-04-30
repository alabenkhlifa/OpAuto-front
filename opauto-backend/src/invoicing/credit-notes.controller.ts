import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CreditNotesService } from './credit-notes.service';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  ModuleAccessGuard,
  RequireModule,
} from '../modules/module-access.guard';

@ApiTags('credit-notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleAccessGuard)
@Roles(UserRole.OWNER, UserRole.STAFF)
@Controller('credit-notes')
export class CreditNotesController {
  constructor(private service: CreditNotesService) {}

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
  create(
    @CurrentUser('garageId') gid: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCreditNoteDto,
  ) {
    return this.service.create(gid, userId, dto);
  }
}
