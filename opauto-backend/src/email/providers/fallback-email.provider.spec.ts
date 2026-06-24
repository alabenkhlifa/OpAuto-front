import {
  FallbackEmailProvider,
  sanitizeEmailProviderError,
} from './fallback-email.provider';
import { EmailProvider } from './email-provider.interface';

function provider(send: jest.Mock): EmailProvider {
  return { send };
}

describe('FallbackEmailProvider', () => {
  const input = { to: 'a@example.com', subject: 'Hello', text: 'Hello' };

  it('uses the primary provider when it succeeds', async () => {
    const primary = jest
      .fn()
      .mockResolvedValue({ providerMessageId: 'mt-1', status: 'queued' });
    const fallback = jest.fn();
    const driver = new FallbackEmailProvider(
      provider(primary),
      provider(fallback),
      'Mailtrap',
      'Resend',
    );

    await expect(driver.send(input)).resolves.toEqual({
      providerMessageId: 'mt-1',
      status: 'queued',
    });
    expect(fallback).not.toHaveBeenCalled();
  });

  it('falls back when the primary provider fails', async () => {
    const primary = jest.fn().mockRejectedValue(new Error('Mailtrap 500'));
    const fallback = jest
      .fn()
      .mockResolvedValue({ providerMessageId: 'rs-1', status: 'queued' });
    const driver = new FallbackEmailProvider(
      provider(primary),
      provider(fallback),
      'Mailtrap',
      'Resend',
    );

    await expect(driver.send(input)).resolves.toEqual({
      providerMessageId: 'rs-1',
      status: 'queued',
    });
    expect(fallback).toHaveBeenCalledWith(input);
  });

  it('throws a combined sanitized error when both providers fail', async () => {
    const primary = jest
      .fn()
      .mockRejectedValue(
        new Error('Authorization: Bearer mailtrap-secret failed'),
      );
    const fallback = jest
      .fn()
      .mockRejectedValue(new Error('RESEND_API_KEY=resend-secret rejected'));
    const driver = new FallbackEmailProvider(
      provider(primary),
      provider(fallback),
      'Mailtrap',
      'Resend',
    );

    await expect(driver.send(input)).rejects.toThrow(
      'Mailtrap email failed: Authorization: Bearer [REDACTED] failed; Resend email failed: RESEND_API_KEY=[REDACTED] rejected',
    );
  });

  it('sanitizes bearer tokens, API token headers, and provider env vars', () => {
    expect(
      sanitizeEmailProviderError(
        new Error(
          'Bearer abc123 Api-Token: xyz MAILTRAP_API_KEY=secret RESEND_API_KEY=secret2',
        ),
      ),
    ).toBe(
      'Bearer [REDACTED] Api-Token: [REDACTED] MAILTRAP_API_KEY=[REDACTED] RESEND_API_KEY=[REDACTED]',
    );
  });
});
