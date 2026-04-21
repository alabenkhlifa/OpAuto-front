import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { TwilioSmsDriver } from '../src/sms/providers/twilio-sms.driver';

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error('Usage: ts-node scripts/test-sms.ts <+E164_NUMBER>');
    process.exit(1);
  }

  const config = new ConfigService();
  const driver = new TwilioSmsDriver(config);

  const body =
    'Bonjour, ceci est un test du système OpAuto Churn AI. Si vous recevez ce SMS, la configuration Twilio est correcte.';

  console.log(`Sending test SMS to ${to}…`);
  try {
    const res = await driver.send(to, body);
    console.log('✅ Success:', res);
  } catch (err: any) {
    console.error('❌ Failed:');
    console.error('  message:', err?.message);
    console.error('  code:   ', err?.code);
    console.error('  status: ', err?.status);
    console.error('  moreInfo:', err?.moreInfo);
    process.exit(1);
  }
}

main();
