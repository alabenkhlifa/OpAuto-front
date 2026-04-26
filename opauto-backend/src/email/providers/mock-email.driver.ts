import { Injectable, Logger } from '@nestjs/common';
import { EmailProvider, EmailSendInput, EmailSendResult } from './email-provider.interface';

@Injectable()
export class MockEmailDriver implements EmailProvider {
  private readonly logger = new Logger(MockEmailDriver.name);

  async send(input: EmailSendInput): Promise<EmailSendResult> {
    const providerMessageId = `mock-email-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const recipients = Array.isArray(input.to) ? input.to.join(',') : input.to;
    this.logger.log(
      `[MOCK EMAIL] to=${recipients} id=${providerMessageId} subject="${input.subject}"`,
    );
    return { providerMessageId, status: 'queued' };
  }
}
