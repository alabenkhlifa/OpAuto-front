import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
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

@ApiTags('quotes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleAccessGuard)
@Roles(UserRole.OWNER, UserRole.STAFF)
@Controller('quotes')
export class QuotesController {
  constructor(
    private service: QuotesService,
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

  /**
   * Deliver an already-SENT quote via email/WhatsApp. Distinct from
   * `POST :id/send` which only allocates the fiscal number.
   */
  @Post(':id/deliver')
  @RequireModule('invoicing')
  deliver(
    @Param('id') id: string,
    @CurrentUser('garageId') gid: string,
    @Body() dto: DeliverDocumentDto,
  ) {
    return this.delivery.deliverQuote(id, gid, dto);
  }

  /**
   * Stream the rendered quote PDF for in-app preview.
   */
  @Get(':id/pdf')
  @RequireModule('invoicing')
  async getPdf(
    @Param('id') id: string,
    @CurrentUser('garageId') gid: string,
    @Res() res: Response,
  ): Promise<void> {
    const quote = await this.service.findOne(id, gid);
    const buf = await this.pdf.renderQuote(id, gid);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="quote-${quote.quoteNumber}.pdf"`,
    );
    res.setHeader('Content-Length', String(buf.length));
    res.end(buf);
  }
}
