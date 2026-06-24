import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  EmailProvider,
  EmailSendInput,
  EmailSendResult,
} from './email-provider.interface';

@Injectable()
export class FallbackEmailProvider implements EmailProvider {
  private readonly logger = new Logger(FallbackEmailProvider.name);

  constructor(
    private readonly primary: EmailProvider,
    private readonly fallback: EmailProvider,
    private readonly primaryName = 'primary',
    private readonly fallbackName = 'fallback',
  ) {}

  async send(input: EmailSendInput): Promise<EmailSendResult> {
    try {
      return await this.primary.send(input);
    } catch (primaryErr) {
      const primaryMessage = sanitizeEmailProviderError(primaryErr);
      this.logger.warn(
        `${this.primaryName} email send failed; falling back to ${this.fallbackName}: ${primaryMessage}`,
      );

      try {
        return await this.fallback.send(input);
      } catch (fallbackErr) {
        const fallbackMessage = sanitizeEmailProviderError(fallbackErr);
        this.logger.error(
          `${this.fallbackName} email fallback failed after ${this.primaryName}: ${fallbackMessage}`,
        );
        throw new InternalServerErrorException(
          `${this.primaryName} email failed: ${primaryMessage}; ${this.fallbackName} email failed: ${fallbackMessage}`,
        );
      }
    }
  }
}

export function sanitizeEmailProviderError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[REDACTED]')
    .replace(/(Api-Token:\s*)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/\b(MAILTRAP_API_KEY|RESEND_API_KEY)=\S+/g, '$1=[REDACTED]')
    .slice(0, 500);
}
