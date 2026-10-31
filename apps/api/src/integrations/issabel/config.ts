import type { ConfigService } from '@nestjs/config';
import type { AmiOptions } from './ami';

export interface IssabelOptions extends AmiOptions {
  connectionId: string;
  context: string;
  technology: 'SIP' | 'PJSIP';
  prefixes: string[];
  nativeCapture: boolean;
  inboundQueues: string[];
  outboundPeers: string[];
  outboundExtensions: string[];
  companyCapture: boolean;
  companyExtensions: string[];
  inboundPeers: string[];
}
export function issabelOptions(config: ConfigService): IssabelOptions | null {
  if (config.get<string>('ISSABEL_ENABLED') !== 'true') return null;
  const value = (name: string) => config.get<string>(`ISSABEL_${name}`) ?? '';
  const options: IssabelOptions = {
    connectionId: value('CONNECTION_ID'),
    host: value('AMI_HOST'),
    port: Number(value('AMI_PORT') || '5039'),
    tls: value('AMI_TLS') !== 'false',
    ...(value('AMI_CA_PEM') ? { ca: value('AMI_CA_PEM') } : {}),
    username: value('AMI_USERNAME'),
    secret: value('AMI_SECRET'),
    context: value('OUTBOUND_CONTEXT') || 'nora-erp-outbound',
    technology: (value('CHANNEL_TECHNOLOGY') || 'PJSIP') as 'SIP' | 'PJSIP',
    prefixes: value('ALLOWED_PREFIXES').split(',').filter(Boolean),
    nativeCapture: value('EVENT_MODE') === 'NATIVE_QUEUE_CAPTURE',
    companyCapture: value('CAPTURE_SCOPE') === 'COMPANY',
    companyExtensions: value('COMPANY_EXTENSIONS')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
    inboundPeers: value('INBOUND_PEERS')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
    outboundPeers: value('OUTBOUND_PEERS')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
    outboundExtensions: value('OUTBOUND_EXTENSIONS')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
    inboundQueues: value('INBOUND_QUEUES')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
  };
  const octets = options.host.split('.').map(Number);
  const privateHost =
    /^\d{1,3}(\.\d{1,3}){3}$/.test(options.host) &&
    octets.every((v) => Number.isInteger(v) && v >= 0 && v <= 255) &&
    (octets[0] === 10 ||
      (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 172 && octets[1]! >= 16 && octets[1]! <= 31));
  // Explicit local-company-network capture; production retains TLS/loopback policy.
  const localCompanyCapture =
    options.nativeCapture &&
    privateHost &&
    config.get<string>('NODE_ENV') === 'development' &&
    value('COMPANY_NETWORK') === 'true';
  if (
    !/^[0-9a-f-]{36}$/i.test(options.connectionId) ||
    !options.host ||
    !Number.isInteger(options.port) ||
    options.port < 1 ||
    options.port > 65535 ||
    !options.username ||
    !options.secret ||
    /[\r\n\0]/.test(options.username + options.secret) ||
    (!options.tls &&
      !['127.0.0.1', '::1', 'localhost'].includes(options.host) &&
      !localCompanyCapture) ||
    !['', 'COMPANY'].includes(value('CAPTURE_SCOPE')) ||
    (options.companyCapture &&
      (!options.nativeCapture ||
        !options.companyExtensions.length ||
        !options.inboundPeers.length ||
        !options.outboundPeers.length)) ||
    options.companyExtensions.length > 500 ||
    options.companyExtensions.some((p) => !/^\d{2,10}$/.test(p)) ||
    options.inboundPeers.length > 100 ||
    options.inboundPeers.some(
      (p) => !/^(SIP|PJSIP)\/[a-zA-Z0-9_.-]{1,64}$/.test(p),
    ) ||
    options.outboundPeers.length > 100 ||
    options.outboundPeers.some(
      (p) => !/^(SIP|PJSIP)\/[a-zA-Z0-9_.-]{1,64}$/.test(p),
    ) ||
    options.outboundExtensions.length > 500 ||
    options.outboundExtensions.some((p) => !/^\d{2,10}$/.test(p)) ||
    !['SIP', 'PJSIP'].includes(options.technology) ||
    !/^[a-zA-Z0-9_-]{1,64}$/.test(options.context) ||
    (!options.nativeCapture && options.prefixes.length === 0) ||
    options.prefixes.some((p) => !/^\+?\d{1,8}$/.test(p)) ||
    !['', 'CUSTOM_FACTS', 'NATIVE_QUEUE_CAPTURE'].includes(
      value('EVENT_MODE'),
    ) ||
    (options.nativeCapture &&
      !options.companyCapture &&
      (options.inboundQueues.length === 0 ||
        options.inboundQueues.length > 100 ||
        options.inboundQueues.some((q) => !/^[a-zA-Z0-9_.:-]{1,100}$/.test(q))))
  )
    throw Error('ISSABEL_INVALID_CONFIGURATION');
  return options;
}
