import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsService } from './sms.service';
import { MockSmsDriver } from './providers/mock-sms.driver';
import { TwilioSmsDriver } from './providers/twilio-sms.driver';
import { SMS_PROVIDER_TOKEN } from './providers/sms-provider.interface';

const smsProviderFactory: Provider = {
  provide: SMS_PROVIDER_TOKEN,
  useFactory: (config: ConfigService) => {
    const driver = (config.get<string>('SMS_PROVIDER') || 'mock').toLowerCase();
    if (driver === 'twilio') {
      return new TwilioSmsDriver(config);
    }
    return new MockSmsDriver();
  },
  inject: [ConfigService],
};

@Module({
  providers: [SmsService, smsProviderFactory],
  exports: [SmsService],
})
export class SmsModule {}
