import {
  InternalServerErrorException,
  Logger,
  Module,
  Provider,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { FallbackEmailProvider } from './providers/fallback-email.provider';
import { MailtrapEmailDriver } from './providers/mailtrap-email.driver';
import { MockEmailDriver } from './providers/mock-email.driver';
import { ResendEmailDriver } from './providers/resend-email.driver';
import { EMAIL_PROVIDER_TOKEN } from './providers/email-provider.interface';

const logger = new Logger('EmailModule');

const emailProviderFactory: Provider = {
  provide: EMAIL_PROVIDER_TOKEN,
  useFactory: createEmailProvider,
  inject: [ConfigService],
};

export function createEmailProvider(config: ConfigService) {
  const driver = (
    config.get<string>('EMAIL_PROVIDER') || 'mailtrap'
  ).toLowerCase();
  if (driver === 'resend') {
    return new ResendEmailDriver(config);
  }
  if (driver === 'mock') {
    return new MockEmailDriver();
  }
  if (driver !== 'mailtrap') {
    throw new InternalServerErrorException(
      `Unsupported EMAIL_PROVIDER "${driver}". Use mailtrap, resend, or mock.`,
    );
  }

  const mailtrapReady = hasConfig(config, 'MAILTRAP_API_KEY', 'MAILTRAP_FROM');
  const resendReady = hasConfig(config, 'RESEND_API_KEY', 'RESEND_FROM');

  if (mailtrapReady) {
    const mailtrap = new MailtrapEmailDriver(config);
    if (resendReady) {
      return new FallbackEmailProvider(
        mailtrap,
        new ResendEmailDriver(config),
        'Mailtrap',
        'Resend',
      );
    }
    return mailtrap;
  }

  if (resendReady) {
    logger.warn('Mailtrap is not configured; using Resend email fallback.');
    return new ResendEmailDriver(config);
  }

  if (
    (config.get<string>('NODE_ENV') || process.env.NODE_ENV) === 'production'
  ) {
    throw new InternalServerErrorException(
      'Email is not configured. Set MAILTRAP_API_KEY and MAILTRAP_FROM, configure RESEND_* fallback, or switch EMAIL_PROVIDER=mock.',
    );
  }

  logger.warn('No real email provider is configured; using mock email driver.');
  return new MockEmailDriver();
}

function hasConfig(config: ConfigService, ...keys: string[]): boolean {
  return keys.every((key) => !!config.get<string>(key)?.trim());
}

@Module({
  providers: [EmailService, emailProviderFactory],
  exports: [EmailService],
})
export class EmailModule {}
