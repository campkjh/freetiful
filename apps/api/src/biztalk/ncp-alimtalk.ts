import { createHmac } from 'crypto';
import type { ConfigService } from '@nestjs/config';

export function ncpAlimtalkConfig(config: ConfigService) {
  const accessKey = config.get<string>('NCP_ACCESS_KEY')?.trim();
  const secretKey = config.get<string>('NCP_SECRET_KEY')?.trim();
  const serviceId = config.get<string>('NCP_ALIMTALK_SERVICE_ID')?.trim();
  const channelId = config.get<string>('NCP_ALIMTALK_CHANNEL_ID')?.trim();
  const host = (config.get<string>('NCP_SENS_HOST')?.trim() || 'https://sens.apigw.ntruss.com').replace(/\/$/, '');
  return { accessKey, secretKey, serviceId, channelId, host, enabled: !!(accessKey && secretKey && serviceId && channelId) };
}

export function ncpSensHeaders(method: string, path: string, accessKey: string, secretKey: string) {
  const ts = Date.now().toString();
  const signature = createHmac('sha256', secretKey).update(`${method} ${path}\n${ts}\n${accessKey}`).digest('base64');
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'x-ncp-apigw-timestamp': ts,
    'x-ncp-iam-access-key': accessKey,
    'x-ncp-apigw-signature-v2': signature,
  };
}
