import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import { CallCenterCrypto } from './call-center.crypto';
import { callSearchMetadata } from './call-center-search';

const crypto = new CallCenterCrypto(
  new ConfigService({
    CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 7).toString(
      'base64',
    ),
    CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64: Buffer.alloc(32, 9).toString(
      'base64',
    ),
    CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION: 1,
  }),
);
const filled = {
  name: 'Synthetic contact',
  phone: '09120000001',
  subject: 'Synthetic completed call',
  source: 'سایت',
  operator: 'داخلی 103',
};

describe('Call Center business information completion', () => {
  it.each([
    { name: '', phone: filled.phone },
    { name: filled.name, phone: '' },
    { name: '', phone: '' },
    { name: '   ', phone: '' },
  ])('allows optional identity fields to be absent: %j', (identity) => {
    const metadata = callSearchMetadata(
      crypto,
      'synthetic-branch',
      { ...filled, ...identity },
      'ANSWERED',
    );
    expect(metadata.needsCompletion).toBe(false);
  });

  it.each(['ANSWERED', 'NO_ANSWER', 'BUSY', 'FAILED', 'WRONG_NUMBER'])(
    'accepts saved outcome %s without inventing a phone or name',
    (outcome) => {
      const unknownIdentity = { ...filled, name: '', phone: '' };
      expect(
        callSearchMetadata(crypto, 'synthetic-branch', unknownIdentity, outcome)
          .needsCompletion,
      ).toBe(false);
      expect(unknownIdentity).toMatchObject({ name: '', phone: '' });
    },
  );

  it.each([
    { subject: '' },
    { subject: '   ' },
    { source: '' },
    { source: '   ' },
    { source: 'نامشخص' },
    { operator: '' },
    { operator: '   ' },
    { operator: 'نامشخص' },
  ])('keeps genuinely missing business fields incomplete: %j', (missing) => {
    expect(
      callSearchMetadata(
        crypto,
        'synthetic-branch',
        { ...filled, ...missing },
        'ANSWERED',
      ).needsCompletion,
    ).toBe(true);
  });

  it.each([undefined, null, ''])(
    'does not mark a call complete without an outcome: %s',
    (outcome) => {
      expect(
        callSearchMetadata(crypto, 'synthetic-branch', filled, outcome)
          .needsCompletion,
      ).toBe(true);
    },
  );
});
