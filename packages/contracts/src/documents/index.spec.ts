import { describe, expect, it } from 'vitest';

import {
  DOCUMENT_ARCHIVE_STATUS_CODES,
  DOCUMENT_CONFIDENTIALITY_CODES,
  DOCUMENT_DOMAIN_CODES,
  DOCUMENT_SCAN_STATUS_CODES,
  DOCUMENTS_CONTRACT_VERSION,
} from './index';

describe('documents shared contract v1', () => {
  it('publishes stable domain, confidentiality, archive and scan allowlists', () => {
    expect(DOCUMENTS_CONTRACT_VERSION).toBe(1);
    expect(DOCUMENT_DOMAIN_CODES).toEqual(
      expect.arrayContaining([
        'CUSTOMER_IDENTITY',
        'SALES',
        'TRAVEL',
        'PROCUREMENT',
        'FINANCE',
        'HUMAN_RESOURCES',
        'GENERAL',
      ]),
    );
    expect(DOCUMENT_CONFIDENTIALITY_CODES).toEqual([
      'PUBLIC',
      'INTERNAL',
      'CONFIDENTIAL',
      'RESTRICTED',
    ]);
    expect(DOCUMENT_ARCHIVE_STATUS_CODES).toEqual([
      'ACTIVE',
      'ARCHIVED',
      'DELETED',
    ]);
    expect(DOCUMENT_SCAN_STATUS_CODES).toContain('AWAITING_ANTIVIRUS_ADAPTER');
  });
});
