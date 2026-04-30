import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { InvoicePublicController } from './invoice-public.controller';
import { InvoiceTokenService } from './invoice-token.service';
import { PrismaModule } from '../prisma/prisma.module';
import { InvoicingModule } from '../invoicing/invoicing.module';

/**
 * PublicModule — registers the public, token-gated PDF endpoints.
 *
 * - InvoiceTokenService signs/verifies the JWTs that gate the routes.
 * - PdfRendererService is re-used from InvoicingModule (re-exported).
 * - JwtModule.register({}) gives a default JwtService instance; the
 *   actual secret/expiry are passed per-call from InvoiceTokenService
 *   so we don't pin a single secret at module-init time.
 *
 * Cycle: InvoicingModule.DeliveryService needs InvoiceTokenService to
 * sign tokens embedded in WhatsApp/email; this module needs
 * PdfRendererService from InvoicingModule. Resolved via `forwardRef`.
 */
@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    PrismaModule,
    forwardRef(() => InvoicingModule),
  ],
  controllers: [InvoicePublicController],
  providers: [InvoiceTokenService],
  exports: [InvoiceTokenService],
})
export class PublicModule {}
