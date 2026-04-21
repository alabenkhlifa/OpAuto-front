import { MockSmsDriver } from './mock-sms.driver';

describe('MockSmsDriver', () => {
  it('returns a synthetic provider message id and queued status', async () => {
    const driver = new MockSmsDriver();
    const res = await driver.send('+216 20 123 456', 'Bonjour');
    expect(res.providerMessageId).toMatch(/^mock-/);
    expect(res.status).toBe('queued');
  });
});
