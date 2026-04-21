import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import { SmsProvider, SmsSendResult } from './sms-provider.interface';

@Injectable()
export class TwilioSmsDriver implements SmsProvider {
  private readonly logger = new Logger(TwilioSmsDriver.name);
  private readonly client: Twilio;
  private readonly fromNumber: string;

  constructor(private readonly config: ConfigService) {
    const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const fromNumber = this.config.get<string>('TWILIO_FROM_NUMBER');

    if (!accountSid || !authToken || !fromNumber) {
      throw new InternalServerErrorException(
        'Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER or switch SMS_PROVIDER=mock.',
      );
    }

    this.client = new Twilio(accountSid, authToken);
    this.fromNumber = fromNumber;
  }

  async send(to: string, body: string): Promise<SmsSendResult> {
    try {
      const msg = await this.client.messages.create({ to, from: this.fromNumber, body });
      return { providerMessageId: msg.sid, status: msg.status };
    } catch (err: any) {
      this.logger.error(`Twilio send failed to=${to}: ${err?.message || err}`);
      throw err;
    }
  }
}
