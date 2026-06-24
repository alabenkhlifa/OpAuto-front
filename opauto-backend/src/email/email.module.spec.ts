import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createEmailProvider } from './email.module';
import { FallbackEmailProvider } from './providers/fallback-email.provider';
import { MailtrapEmailDriver } from './providers/mailtrap-email.driver';
import { MockEmailDriver } from './providers/mock-email.driver';
import { ResendEmailDriver } from './providers/resend-email.driver';

function config(values: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('createEmailProvider', () => {
  it('uses Mailtrap by default when Mailtrap is configured', () => {
    const provider = createEmailProvider(
      config({
        MAILTRAP_API_KEY: 'mailtrap-key',
        MAILTRAP_FROM: 'no-reply@example.com',
      }),
    );

    expect(provider).toBeInstanceOf(MailtrapEmailDriver);
  });

  it('wraps Mailtrap with Resend fallback when both are configured', () => {
    const provider = createEmailProvider(
      config({
        MAILTRAP_API_KEY: 'mailtrap-key',
        MAILTRAP_FROM: 'no-reply@example.com',
        RESEND_API_KEY: 'resend-key',
        RESEND_FROM: 'no-reply@example.com',
      }),
    );

    expect(provider).toBeInstanceOf(FallbackEmailProvider);
  });

  it('uses Resend when explicitly selected', () => {
    const provider = createEmailProvider(
      config({
        EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 'resend-key',
        RESEND_FROM: 'no-reply@example.com',
      }),
    );

    expect(provider).toBeInstanceOf(ResendEmailDriver);
  });

  it('uses mock when explicitly selected', () => {
    const provider = createEmailProvider(config({ EMAIL_PROVIDER: 'mock' }));

    expect(provider).toBeInstanceOf(MockEmailDriver);
  });

  it('uses Resend fallback when Mailtrap is missing and Resend is configured', () => {
    const provider = createEmailProvider(
      config({
        RESEND_API_KEY: 'resend-key',
        RESEND_FROM: 'no-reply@example.com',
      }),
    );

    expect(provider).toBeInstanceOf(ResendEmailDriver);
  });

  it('uses mock outside production when no real provider is configured', () => {
    const provider = createEmailProvider(config({ NODE_ENV: 'test' }));

    expect(provider).toBeInstanceOf(MockEmailDriver);
  });

  it('fails in production when no real provider is configured', () => {
    expect(() =>
      createEmailProvider(config({ NODE_ENV: 'production' })),
    ).toThrow(InternalServerErrorException);
  });
});
