import { Inject, Injectable } from '@nestjs/common';
import { SMS_PROVIDER_TOKEN, SmsProvider, SmsSendResult } from './providers/sms-provider.interface';

@Injectable()
export class SmsService {
  constructor(@Inject(SMS_PROVIDER_TOKEN) private readonly provider: SmsProvider) {}

  send(to: string, body: string): Promise<SmsSendResult> {
    return this.provider.send(to, body);
  }
}
