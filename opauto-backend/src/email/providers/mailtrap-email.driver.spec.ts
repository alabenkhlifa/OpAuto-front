import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailtrapEmailDriver } from './mailtrap-email.driver';

function config(values: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('MailtrapEmailDriver', () => {
  it('maps the shared email input to a Mailtrap send payload', async () => {
    const send = jest.fn().mockResolvedValue({
      success: true,
      message_ids: ['mt-1'],
    });
    const driver = new MailtrapEmailDriver(
      config({
        MAILTRAP_API_KEY: 'mailtrap-key',
        MAILTRAP_FROM: 'no-reply@example.com',
        MAILTRAP_FROM_NAME: 'OpAuto',
      }),
      { send } as never,
    );

    const result = await driver.send({
      to: ['a@example.com', 'b@example.com'],
      subject: 'Hello',
      html: '<p>Hello</p>',
      text: 'Hello',
      replyTo: 'owner@example.com',
      attachments: [
        {
          filename: 'invoice.pdf',
          content: Buffer.from('pdf bytes'),
          contentType: 'application/pdf',
        },
        {
          filename: 'invoices.csv',
          content: Buffer.from('csv bytes').toString('base64'),
          contentType: 'text/csv',
        },
      ],
    });

    expect(send).toHaveBeenCalledWith({
      from: { email: 'no-reply@example.com', name: 'OpAuto' },
      to: [{ email: 'a@example.com' }, { email: 'b@example.com' }],
      subject: 'Hello',
      text: 'Hello',
      html: '<p>Hello</p>',
      reply_to: { email: 'owner@example.com' },
      attachments: [
        {
          filename: 'invoice.pdf',
          content: Buffer.from('pdf bytes').toString('base64'),
          type: 'application/pdf',
          disposition: 'attachment',
        },
        {
          filename: 'invoices.csv',
          content: Buffer.from('csv bytes').toString('base64'),
          type: 'text/csv',
          disposition: 'attachment',
        },
      ],
    });
    expect(result).toEqual({ providerMessageId: 'mt-1', status: 'queued' });
  });

  it('uses the first recipient message id and falls back to unknown when absent', async () => {
    const driver = new MailtrapEmailDriver(
      config({
        MAILTRAP_API_KEY: 'mailtrap-key',
        MAILTRAP_FROM: 'no-reply@example.com',
      }),
      {
        send: jest.fn().mockResolvedValue({ success: true, message_ids: [] }),
      } as never,
    );

    await expect(
      driver.send({ to: 'a@example.com', subject: 'Hello', text: 'Hello' }),
    ).resolves.toEqual({ providerMessageId: 'unknown', status: 'queued' });
  });

  it('fails fast when required Mailtrap config is missing', () => {
    expect(
      () =>
        new MailtrapEmailDriver(
          config({
            MAILTRAP_API_KEY: 'mailtrap-key',
            MAILTRAP_FROM: '',
          }),
          { send: jest.fn() } as never,
        ),
    ).toThrow(InternalServerErrorException);
  });

  it('fails fast when sandbox mode is enabled without an inbox id', () => {
    expect(
      () =>
        new MailtrapEmailDriver(
          config({
            MAILTRAP_API_KEY: 'mailtrap-key',
            MAILTRAP_FROM: 'sandbox@example.com',
            MAILTRAP_USE_SANDBOX: 'true',
          }),
          undefined,
        ),
    ).toThrow('Mailtrap sandbox is not configured');
  });

  it('fails fast when sandbox inbox id is invalid', () => {
    expect(
      () =>
        new MailtrapEmailDriver(
          config({
            MAILTRAP_API_KEY: 'mailtrap-key',
            MAILTRAP_FROM: 'sandbox@example.com',
            MAILTRAP_USE_SANDBOX: 'true',
            MAILTRAP_INBOX_ID: 'not-a-number',
          }),
          undefined,
        ),
    ).toThrow('Mailtrap sandbox is not configured');
  });

  it('accepts sandbox mode when an inbox id is configured', async () => {
    const send = jest.fn().mockResolvedValue({
      success: true,
      message_ids: ['sandbox-1'],
    });
    const driver = new MailtrapEmailDriver(
      config({
        MAILTRAP_API_KEY: 'mailtrap-key',
        MAILTRAP_FROM: 'sandbox@example.com',
        MAILTRAP_USE_SANDBOX: 'true',
        MAILTRAP_INBOX_ID: '123456',
      }),
      { send } as never,
    );

    await expect(
      driver.send({
        to: 'anyone@example.com',
        subject: 'Hello',
        text: 'Hello',
      }),
    ).resolves.toEqual({ providerMessageId: 'sandbox-1', status: 'queued' });
  });

  it('throws when Mailtrap returns an unsuccessful response', async () => {
    const driver = new MailtrapEmailDriver(
      config({
        MAILTRAP_API_KEY: 'mailtrap-key',
        MAILTRAP_FROM: 'no-reply@example.com',
      }),
      {
        send: jest.fn().mockResolvedValue({
          success: false,
          errors: ['Forbidden'],
        }),
      } as never,
    );

    await expect(
      driver.send({ to: 'a@example.com', subject: 'Hello', text: 'Hello' }),
    ).rejects.toThrow('Mailtrap error: Forbidden');
  });
});
