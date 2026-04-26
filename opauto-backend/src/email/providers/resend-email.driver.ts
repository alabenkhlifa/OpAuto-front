import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EmailProvider, EmailSendInput, EmailSendResult } from './email-provider.interface';

@Injectable()
export class ResendEmailDriver implements EmailProvider {
  private readonly logger = new Logger(ResendEmailDriver.name);
  private readonly client: Resend;
  private readonly fromAddress: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const fromAddress = this.config.get<string>('RESEND_FROM');

    if (!apiKey || !fromAddress) {
      throw new InternalServerErrorException(
        'Resend is not configured. Set RESEND_API_KEY and RESEND_FROM, or switch EMAIL_PROVIDER=mock.',
      );
    }

    this.client = new Resend(apiKey);
    this.fromAddress = fromAddress;
  }

  async send(input: EmailSendInput): Promise<EmailSendResult> {
    try {
      const response = await this.client.emails.send({
        from: this.fromAddress,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo: input.replyTo,
        attachments: input.attachments?.map((a) => ({
          filename: a.filename,
          content: typeof a.content === 'string' ? a.content : a.content,
          contentType: a.contentType,
        })),
      });

      if (response.error) {
        this.logger.error(`Resend send failed: ${response.error.message}`);
        throw new InternalServerErrorException(`Resend error: ${response.error.message}`);
      }

      return {
        providerMessageId: response.data?.id ?? 'unknown',
        status: 'queued',
      };
    } catch (err: any) {
      const recipients = Array.isArray(input.to) ? input.to.join(',') : input.to;
      this.logger.error(`Resend send failed to=${recipients}: ${err?.message || err}`);
      throw err;
    }
  }
}
