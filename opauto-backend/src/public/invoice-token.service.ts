import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';

export type PublicTokenKind = 'invoice' | 'quote' | 'creditNote';

export interface InvoiceTokenPayload {
  /** Document UUID — invoiceId / quoteId / creditNoteId. */
  id: string;
  /** Discriminator so a token issued for an invoice can't be replayed
   *  on the credit-note route. */
  type: PublicTokenKind;
}

/**
 * InvoiceTokenService — signs and verifies opaque JWTs that act as
 * single-purpose, time-bounded credentials for public document URLs.
 *
 * Design:
 *   - Secret comes from `INVOICE_TOKEN_SECRET` (falls back to `JWT_SECRET`
 *     so dev/test environments can rely on the existing variable).
 *   - 30-day expiry by default — invoices can sit unviewed for weeks.
 *   - The token IS the auth: anyone with the URL can fetch the PDF.
 *     Treat it as a bearer credential; rotation requires re-issuing
 *     a new token (no token list is maintained).
 *   - The `type` claim is enforced on verify: a token issued as an
 *     invoice cannot be used to fetch a quote even if IDs collide.
 */
@Injectable()
export class InvoiceTokenService {
  private readonly secret: string;
  private readonly expiresIn: string;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.secret =
      this.config.get<string>('INVOICE_TOKEN_SECRET') ??
      this.config.get<string>('JWT_SECRET') ??
      'opauto-dev-invoice-secret';
    this.expiresIn =
      this.config.get<string>('INVOICE_TOKEN_EXPIRES_IN') ?? '30d';
  }

  /**
   * Sign a token for the given document. Returns the raw JWT string.
   */
  sign(id: string, type: PublicTokenKind): string {
    const payload: InvoiceTokenPayload = { id, type };
    return this.jwt.sign(payload, {
      secret: this.secret,
      expiresIn: this.expiresIn,
    });
  }

  /**
   * Verify a token and return its payload. Throws UnauthorizedException
   * on any of: bad signature, expired, missing claims, wrong type.
   */
  verify(token: string, expectedType?: PublicTokenKind): InvoiceTokenPayload {
    let payload: InvoiceTokenPayload;
    try {
      payload = this.jwt.verify<InvoiceTokenPayload>(token, {
        secret: this.secret,
      });
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        throw new UnauthorizedException('Token expired');
      }
      throw new UnauthorizedException('Invalid token');
    }

    if (!payload?.id || !payload?.type) {
      throw new UnauthorizedException('Malformed token');
    }
    if (expectedType && payload.type !== expectedType) {
      throw new UnauthorizedException(
        `Token type mismatch: expected ${expectedType}, got ${payload.type}`,
      );
    }
    return payload;
  }
}
