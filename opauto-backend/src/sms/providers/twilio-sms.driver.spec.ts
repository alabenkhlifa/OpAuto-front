import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';

const createMock = jest.fn();

jest.mock('twilio', () => {
  return {
    Twilio: jest.fn().mockImplementation(() => ({
      messages: { create: createMock },
    })),
  };
});

import { TwilioSmsDriver } from './twilio-sms.driver';

const makeConfig = (values: Record<string, string | undefined>): ConfigService => {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
};

describe('TwilioSmsDriver', () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it('throws when config is missing', () => {
    expect(() => new TwilioSmsDriver(makeConfig({}))).toThrow(InternalServerErrorException);
  });

  it('sends via the Twilio client and returns the SID + status', async () => {
    createMock.mockResolvedValue({ sid: 'SM123', status: 'queued' });
    const driver = new TwilioSmsDriver(
      makeConfig({
        TWILIO_ACCOUNT_SID: 'AC_test',
        TWILIO_AUTH_TOKEN: 'token',
        TWILIO_FROM_NUMBER: '+1555',
      }),
    );

    const res = await driver.send('+216 20 123 456', 'Bonjour');
    expect(res).toEqual({ providerMessageId: 'SM123', status: 'queued' });
    expect(createMock).toHaveBeenCalledWith({ to: '+216 20 123 456', from: '+1555', body: 'Bonjour' });
  });

  it('propagates Twilio errors', async () => {
    createMock.mockRejectedValue(new Error('invalid phone'));
    const driver = new TwilioSmsDriver(
      makeConfig({
        TWILIO_ACCOUNT_SID: 'AC_test',
        TWILIO_AUTH_TOKEN: 'token',
        TWILIO_FROM_NUMBER: '+1555',
      }),
    );

    await expect(driver.send('+bad', 'body')).rejects.toThrow('invalid phone');
  });
});
