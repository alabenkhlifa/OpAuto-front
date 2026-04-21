import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider, SmsSendResult } from './sms-provider.interface';

@Injectable()
export class MockSmsDriver implements SmsProvider {
  private readonly logger = new Logger(MockSmsDriver.name);

  async send(to: string, body: string): Promise<SmsSendResult> {
    const providerMessageId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    this.logger.log(`[MOCK SMS] to=${to} id=${providerMessageId} body="${body}"`);
    return { providerMessageId, status: 'queued' };
  }
}
