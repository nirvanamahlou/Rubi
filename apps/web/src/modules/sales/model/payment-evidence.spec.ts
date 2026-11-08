import { describe, expect, it } from 'vitest';
import type { DocumentOptionsResponseV1 } from '@nora/contracts';
import { printFixture } from './contract-print.fixture';
import {
  paymentDocumentQuery,
  paymentEvidenceForm,
  paymentDocumentScanLabel,
} from './payment-evidence';
const contract = {
  ...printFixture.contract,
  payments: [
    {
      id: 'payment',
      amount: '10',
      currencyCode: 'IRR',
      method: 'CASH' as const,
      status: 'PENDING_FINANCE_CONFIRMATION' as const,
      dueAt: '2026-09-07',
      createdAt: '2026-09-07T00:00:00Z',
      financeConfirmedAt: null,
    },
  ],
};
const options = {
  currentUserId: 'actor',
  branches: [{ id: 'branch' }],
  owners: [],
  documentTypes: [
    {
      id: 'receipt',
      code: 'RECEIPT',
      domain: 'FINANCE',
      requiresExpiry: false,
      allowedMimeTypes: ['application/pdf'],
      maxFileSizeBytes: 1000,
    },
  ],
  categories: [{ id: 'finance', code: 'PROCUREMENT_FINANCE' }],
  uploadPolicy: {
    maxFileSizeBytes: 1000,
    allowedMimeTypes: ['application/pdf'],
    antivirusAvailable: false,
  },
} as unknown as DocumentOptionsResponseV1['data'];
describe('payment evidence public Documents binding', () => {
  it('binds the exact saved payment and branch, not the customer or entire contract', () => {
    expect(paymentDocumentQuery(contract, 'payment', 2)).toMatchObject({
      branchId: 'branch',
      sourceModule: 'sales',
      sourceEntityType: 'SalesContractPaymentEntry',
      sourceEntityId: 'payment',
      page: 2,
    });
    expect(() => paymentDocumentQuery(contract, 'other')).toThrow();
  });
  it('uploads a restricted receipt through existing registered references without changing Finance', () => {
    const before = structuredClone(contract);
    const form = paymentEvidenceForm(
      contract,
      'payment',
      options,
      new File(['%PDF'], 'proof.pdf', { type: 'application/pdf' }),
    );
    expect(form.get('confidentiality')).toBe('RESTRICTED');
    expect(form.get('sourceEntityId')).toBe('payment');
    expect(form.get('documentTypeId')).toBe('receipt');
    expect(form.get('ownerUserId')).toBe('actor');
    expect(contract).toEqual(before);
    expect(paymentDocumentScanLabel('CLEAN')).not.toContain('تأیید پرداخت');
  });
  it('rejects missing access/reference, oversized and unsafe files', () => {
    const pdf = new File(['%PDF'], 'proof.pdf', { type: 'application/pdf' });
    expect(() =>
      paymentEvidenceForm(
        contract,
        'payment',
        { ...options, branches: [] },
        pdf,
      ),
    ).toThrow();
    expect(() =>
      paymentEvidenceForm(
        contract,
        'payment',
        { ...options, documentTypes: [] },
        pdf,
      ),
    ).toThrow();
    expect(() =>
      paymentEvidenceForm(
        contract,
        'payment',
        options,
        new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' }),
      ),
    ).toThrow();
    expect(() =>
      paymentEvidenceForm(
        contract,
        'payment',
        options,
        new File(['x'.repeat(1001)], 'x.pdf', { type: 'application/pdf' }),
      ),
    ).toThrow();
  });
});

it.each([
  ['proof.jfif', 'image/jfif', 'image/jpeg'],
  [
    'proof.xlsx',
    '',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  ['proof.xls', 'application/octet-stream', 'application/vnd.ms-excel'],
])(
  'accepts %s while retaining document type/size restrictions',
  (name, browserMime, canonicalMime) => {
    const file = new File(['synthetic'], name!, { type: browserMime! });
    const permitted = {
      ...options,
      documentTypes: options.documentTypes.map((type) => ({
        ...type,
        allowedMimeTypes: [canonicalMime!],
      })),
      uploadPolicy: {
        ...options.uploadPolicy,
        allowedMimeTypes: [canonicalMime!],
      },
    };
    expect(
      paymentEvidenceForm(contract, 'payment', permitted, file).get('file'),
    ).toBe(file);
    expect(() =>
      paymentEvidenceForm(contract, 'payment', options, file),
    ).toThrow();
  },
);
