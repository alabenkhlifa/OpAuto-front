import { Inject, Injectable } from '@nestjs/common';
import {
  EMAIL_PROVIDER_TOKEN,
  EmailProvider,
  EmailSendInput,
  EmailSendResult,
} from './providers/email-provider.interface';

@Injectable()
export class EmailService {
  constructor(@Inject(EMAIL_PROVIDER_TOKEN) private readonly provider: EmailProvider) {}

  send(input: EmailSendInput): Promise<EmailSendResult> {
    return this.provider.send(input);
  }
}
