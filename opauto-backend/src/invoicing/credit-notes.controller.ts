import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { CreditNotesService } from './credit-notes.service';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import { DeliverDocumentDto } from './dto/deliver-document.dto';
import { DeliveryService } from './delivery.service';
import { PdfRendererService } from './pdf-renderer.service';
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
  constructor(
    private service: CreditNotesService,
    private delivery: DeliveryService,
    private pdf: PdfRendererService,
  ) {}

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

  @Post(':id/deliver')
  @RequireModule('invoicing')
  deliver(
    @Param('id') id: string,
    @CurrentUser('garageId') gid: string,
    @Body() dto: DeliverDocumentDto,
  ) {
    return this.delivery.deliverCreditNote(id, gid, dto);
  }

  @Get(':id/pdf')
  @RequireModule('invoicing')
  async getPdf(
    @Param('id') id: string,
    @CurrentUser('garageId') gid: string,
    @Res() res: Response,
  ): Promise<void> {
    const cn = await this.service.findOne(id, gid);
    const buf = await this.pdf.renderCreditNote(id, gid);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="credit-note-${cn.creditNoteNumber}.pdf"`,
    );
    res.setHeader('Content-Length', String(buf.length));
    res.end(buf);
  }
}
