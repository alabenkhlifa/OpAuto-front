import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailtrapClient } from 'mailtrap';
import type { Address, Attachment as MailtrapAttachment, Mail } from 'mailtrap';
import {
  EmailProvider,
  EmailSendInput,
  EmailSendResult,
} from './email-provider.interface';

type MailtrapClientLike = Pick<MailtrapClient, 'send'>;

@Injectable()
export class MailtrapEmailDriver implements EmailProvider {
  private readonly logger = new Logger(MailtrapEmailDriver.name);
  private readonly client: MailtrapClientLike;
  private readonly from: Address;

  constructor(
    private readonly config: ConfigService,
    client?: MailtrapClientLike,
  ) {
    const apiKey = this.config.get<string>('MAILTRAP_API_KEY')?.trim();
    const fromAddress = this.config.get<string>('MAILTRAP_FROM')?.trim();
    const fromName = this.config.get<string>('MAILTRAP_FROM_NAME')?.trim();
    const useSandbox = isEnabled(
      this.config.get<string>('MAILTRAP_USE_SANDBOX'),
    );
    const inboxId = parseInboxId(this.config.get<string>('MAILTRAP_INBOX_ID'));

    if (!apiKey || !fromAddress) {
      throw new InternalServerErrorException(
        'Mailtrap is not configured. Set MAILTRAP_API_KEY and MAILTRAP_FROM, or switch EMAIL_PROVIDER=mock.',
      );
    }

    if (useSandbox && !inboxId) {
      throw new InternalServerErrorException(
        'Mailtrap sandbox is not configured. Set MAILTRAP_INBOX_ID or set MAILTRAP_USE_SANDBOX=false.',
      );
    }

    this.client =
      client ??
      new MailtrapClient({
        token: apiKey,
        sandbox: useSandbox,
        testInboxId: inboxId,
      });
    this.from = fromName
      ? { email: fromAddress, name: fromName }
      : { email: fromAddress };
  }

  async send(input: EmailSendInput): Promise<EmailSendResult> {
    try {
      const response = await this.client.send(this.toMailtrapMail(input));

      if (!response?.success) {
        const message = Array.isArray((response as any)?.errors)
          ? (response as any).errors.join('; ')
          : 'unknown Mailtrap error';
        this.logger.error(`Mailtrap send failed: ${message}`);
        throw new InternalServerErrorException(`Mailtrap error: ${message}`);
      }

      return {
        providerMessageId: response.message_ids?.[0] ?? 'unknown',
        status: 'queued',
      };
    } catch (err: any) {
      const recipients = Array.isArray(input.to)
        ? input.to.join(',')
        : input.to;
      this.logger.error(
        `Mailtrap send failed to=${recipients}: ${err?.message || err}`,
      );
      throw err;
    }
  }

  private toMailtrapMail(input: EmailSendInput): Mail {
    return {
      from: this.from,
      to: this.toAddresses(input.to),
      subject: input.subject,
      ...(input.text ? { text: input.text } : {}),
      ...(input.html ? { html: input.html } : {}),
      ...(input.replyTo ? { reply_to: { email: input.replyTo } } : {}),
      ...(input.attachments?.length
        ? { attachments: input.attachments.map((a) => this.toAttachment(a)) }
        : {}),
    } as Mail;
  }

  private toAddresses(to: string | string[]): Address[] {
    const recipients = Array.isArray(to) ? to : [to];
    return recipients.map((email) => ({ email }));
  }

  private toAttachment(
    attachment: NonNullable<EmailSendInput['attachments']>[number],
  ): MailtrapAttachment {
    return {
      filename: attachment.filename,
      content: Buffer.isBuffer(attachment.content)
        ? attachment.content.toString('base64')
        : attachment.content,
      type: attachment.contentType,
      disposition: 'attachment',
    };
  }
}

export function isEnabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    (value ?? '').trim().toLowerCase(),
  );
}

function parseInboxId(value: string | undefined): number | undefined {
  const normalized = value?.trim();
  if (!normalized || !/^\d+$/.test(normalized)) return undefined;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
