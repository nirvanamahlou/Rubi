import type { ConfigService } from '@nestjs/config';
import type { AmiOptions } from './ami';

export interface IssabelOptions extends AmiOptions {
  connectionId: string;
  context: string;
  technology: 'SIP' | 'PJSIP';
  prefixes: string[];
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
  };
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
      !['127.0.0.1', '::1', 'localhost'].includes(options.host)) ||
    !['SIP', 'PJSIP'].includes(options.technology) ||
    !/^[a-zA-Z0-9_-]{1,64}$/.test(options.context) ||
    options.prefixes.length === 0 ||
    options.prefixes.some((p) => !/^\+?\d{1,8}$/.test(p))
  )
    throw Error('ISSABEL_INVALID_CONFIGURATION');
  return options;
}
