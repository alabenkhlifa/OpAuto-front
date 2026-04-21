export interface SmsSendResult {
  providerMessageId: string;
  status: string;
}

export interface SmsProvider {
  send(to: string, body: string): Promise<SmsSendResult>;
}

export const SMS_PROVIDER_TOKEN = 'SMS_PROVIDER_TOKEN';
