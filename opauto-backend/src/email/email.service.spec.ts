import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { MockEmailDriver } from './providers/mock-email.driver';
import { EMAIL_PROVIDER_TOKEN } from './providers/email-provider.interface';

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: EMAIL_PROVIDER_TOKEN, useClass: MockEmailDriver },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('delegates to the configured provider', async () => {
    const result = await service.send({
      to: 'owner@example.com',
      subject: 'Test',
      text: 'hello',
    });

    expect(result.providerMessageId).toMatch(/^mock-email-/);
    expect(result.status).toBe('queued');
  });

  it('handles array of recipients', async () => {
    const result = await service.send({
      to: ['a@example.com', 'b@example.com'],
      subject: 'Multi',
      html: '<p>hi</p>',
    });

    expect(result.providerMessageId).toBeDefined();
    expect(result.status).toBe('queued');
  });
});
