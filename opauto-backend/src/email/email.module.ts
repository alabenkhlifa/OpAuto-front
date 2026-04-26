import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { MockEmailDriver } from './providers/mock-email.driver';
import { ResendEmailDriver } from './providers/resend-email.driver';
import { EMAIL_PROVIDER_TOKEN } from './providers/email-provider.interface';

const emailProviderFactory: Provider = {
  provide: EMAIL_PROVIDER_TOKEN,
  useFactory: (config: ConfigService) => {
    const driver = (config.get<string>('EMAIL_PROVIDER') || 'mock').toLowerCase();
    if (driver === 'resend') {
      return new ResendEmailDriver(config);
    }
    return new MockEmailDriver();
  },
  inject: [ConfigService],
};

@Module({
  providers: [EmailService, emailProviderFactory],
  exports: [EmailService],
})
export class EmailModule {}
