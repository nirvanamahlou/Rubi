import { describe, expect, it } from 'vitest';

import {
  DOCUMENT_ARCHIVE_STATUS_CODES,
  DOCUMENT_CONFIDENTIALITY_CODES,
  DOCUMENT_DOMAIN_CODES,
  DOCUMENT_PERSONAL_VIEW_CODES,
  DOCUMENT_SCAN_STATUS_CODES,
  DOCUMENTS_CONTRACT_VERSION,
} from './index';
import type {
  DocumentCaseOptionsQueryV1,
  DocumentCaseOptionsResponseV1,
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
    expect(DOCUMENT_PERSONAL_VIEW_CODES).toEqual([
      'OWNED',
      'UPLOADED',
      'RECENTLY_VIEWED',
    ]);
  });

  it('keeps case search branch-scoped without exposing source record ids', () => {
    const query: DocumentCaseOptionsQueryV1 = {
      branchId: 'branch-1',
      search: 'قرارداد',
      limit: 20,
    };
    const response: DocumentCaseOptionsResponseV1 = {
      data: [
        {
          id: 'relation-1',
          displayLabel: 'قرارداد فروش ۴۲',
        },
      ],
      meta: { hasMore: false, limit: query.limit ?? 20 },
    };

    expect(response.data[0]).not.toHaveProperty('sourceEntityId');
  });
});
