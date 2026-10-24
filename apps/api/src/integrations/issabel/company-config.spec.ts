import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { issabelOptions } from './config';

const base = {
  ISSABEL_ENABLED: 'true',
  ISSABEL_CONNECTION_ID: '11111111-1111-4111-8111-111111111111',
  ISSABEL_AMI_HOST: '127.0.0.1',
  ISSABEL_AMI_USERNAME: 'test',
  ISSABEL_AMI_SECRET: 'test-only',
  ISSABEL_EVENT_MODE: 'NATIVE_QUEUE_CAPTURE',
  ISSABEL_CAPTURE_SCOPE: 'COMPANY',
  ISSABEL_COMPANY_EXTENSIONS: '101,102',
  ISSABEL_INBOUND_PEERS: 'PJSIP/carrier',
  ISSABEL_OUTBOUND_PEERS: 'PJSIP/carrier',
};
describe('explicit company capture configuration', () => {
  it('captures all queues only when company inventory is explicit', () => {
    expect(issabelOptions(new ConfigService(base))).toMatchObject({
      companyCapture: true,
      companyExtensions: ['101', '102'],
      inboundQueues: [],
    });
  });
  it('rejects partial inventory, wildcards and mistaken mode instead of capturing arbitrary channels', () => {
    for (const patch of [
      { ISSABEL_COMPANY_EXTENSIONS: '' },
      { ISSABEL_COMPANY_EXTENSIONS: '*' },
      { ISSABEL_INBOUND_PEERS: '' },
      { ISSABEL_INBOUND_PEERS: 'PJSIP/*' },
      { ISSABEL_OUTBOUND_PEERS: '' },
      { ISSABEL_EVENT_MODE: 'CUSTOM_FACTS' },
      { ISSABEL_CAPTURE_SCOPE: 'company' },
    ])
      expect(() =>
        issabelOptions(new ConfigService({ ...base, ...patch })),
      ).toThrow('ISSABEL_INVALID_CONFIGURATION');
  });
  it('leaves legacy queue capture opt-in and unchanged', () => {
    expect(
      issabelOptions(
        new ConfigService({
          ...base,
          ISSABEL_CAPTURE_SCOPE: '',
          ISSABEL_INBOUND_QUEUES: '1002',
        }),
      ),
    ).toMatchObject({ companyCapture: false, inboundQueues: ['1002'] });
  });
});
