import { describe, expect, it } from 'vitest';

import { b2bEndpoints, type B2bCrmPaymentDocumentsV1 } from './index';

describe('B2B CRM payment-document contract', () => {
  it('keeps the organization and contract in the canonical endpoint path', () => {
    expect(
      b2bEndpoints.agencyCrmPaymentDocuments(
        'organization/one',
        'contract/two',
      ),
    ).toBe(
      '/api/v1/b2b/agencies/organization%2Fone/crm-connections/contracts/contract%2Ftwo/payment-documents',
    );
  });

  it('exposes minimal metadata without bytes, URLs or grants', () => {
    const response: B2bCrmPaymentDocumentsV1 = {
      version: 1,
      organizationId: 'organization',
      branchId: 'branch',
      contractId: 'contract',
      payments: [
        {
          paymentId: 'payment',
          documents: [
            {
              id: 'document',
              title: 'رسید',
              type: { code: 'RECEIPT', name: 'رسید پرداخت' },
              confidentiality: 'RESTRICTED',
              currentVersion: {
                originalFileName: 'masked.pdf',
                safeDownloadName: 'masked.pdf',
                detectedMimeType: 'application/pdf',
                sizeBytes: 10,
                scanStatus: 'CLEAN',
              },
              capabilities: { viewFile: true, download: false },
              updatedAt: '2026-10-03T00:00:00.000Z',
            },
          ],
        },
      ],
      observedAt: '2026-10-03T00:00:00.000Z',
    };
    expect(response.payments[0]?.documents[0]).not.toHaveProperty('url');
    expect(response.payments[0]?.documents[0]).not.toHaveProperty('bytes');
    expect(response.payments[0]?.documents[0]).not.toHaveProperty('grant');
  });
});
