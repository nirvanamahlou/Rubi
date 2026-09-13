import { describe, expect, it } from 'vitest';
import type { ProcurementDraftV1 } from '@rubi/contracts';
import {
  assertReceipt,
  decimal,
  decimalString,
  documentTotal,
  lineTotal,
  matchInvoice,
  multiply,
  normalizeInvoiceNumber,
  validatePolicy,
  validateSubmission,
  type ApprovalPolicy,
  type CommercialLine,
} from './procurement.rules';

const draft = (
  changes: Partial<ProcurementDraftV1> = {},
): ProcurementDraftV1 => ({
  title: 'Office equipment',
  branchId: 'branch-1',
  unitId: 'unit-1',
  purchaseType: 'GENERAL',
  category: 'EQUIPMENT',
  needReason: 'Replace broken equipment',
  requiredAt: '2026-10-01T00:00:00.000Z',
  priority: 'NORMAL',
  urgent: false,
  urgencyReason: '',
  estimatedAmount: '100',
  currencyCode: 'IRR',
  unknownEstimateReason: '',
  deliveryLocation: 'Main office',
  notes: '',
  documents: [],
  origin: { kind: 'GENERAL' },
  items: [
    {
      id: 'item-1',
      kind: 'GOODS',
      description: 'Equipment',
      specification: '',
      quantity: '10',
      unit: 'piece',
      acceptanceCriteria: '',
      period: '',
    },
  ],
  ...changes,
});
const policy = (changes: Partial<ApprovalPolicy> = {}): ApprovalPolicy => ({
  id: 'policy-1',
  version: 1,
  source: 'Approved procurement policy',
  approvedAt: '2026-09-01T00:00:00.000Z',
  branchId: 'branch-1',
  unitId: 'unit-1',
  category: 'EQUIPMENT',
  currencyCode: 'IRR',
  maximumAmount: '100',
  allowUnknownEstimate: false,
  emergencyAllowed: false,
  minimumQuotations: 3,
  singleSourceAllowed: false,
  steps: [
    {
      userId: 'checker-1',
      maximumAmount: '100',
      permission: 'procurement.approve',
    },
  ],
  ...changes,
});
const line = (changes: Partial<CommercialLine> = {}): CommercialLine => ({
  itemId: 'item-1',
  quantity: '10',
  unitPrice: '10',
  discount: '0',
  tax: '0',
  extraCost: '0',
  ...changes,
});
const failsWith = (action: () => unknown, code: string, field?: string) => {
  expect(action).toThrowError(
    expect.objectContaining({ code, ...(field ? { field } : {}) }),
  );
};

describe('Procurement exact decimal money and quantity', () => {
  it('retains four fractional places and values larger than JavaScript safe integers', () => {
    expect(decimalString(decimal('99999999999999999999.9999'))).toBe(
      '99999999999999999999.9999',
    );
    expect(multiply('9007199254740993.0001', '1')).toBe(
      '9007199254740993.0001',
    );
    expect(
      documentTotal([
        line({ quantity: '1', unitPrice: '0.1' }),
        line({ itemId: 'item-2', quantity: '1', unitPrice: '0.2' }),
      ]),
    ).toBe('0.3');
  });
  it.each([
    0.1,
    '1e3',
    '-1',
    '01',
    '1.00001',
    'NaN',
    '',
    '100000000000000000000',
  ])('rejects ambiguous or out-of-range input %s', (input) => {
    failsWith(() => decimal(input), 'VALIDATION_ERROR');
  });
  it('refuses unapproved rounding even when the discarded amount is small', () => {
    failsWith(() => multiply('0.0001', '0.1'), 'ROUNDING_POLICY_REQUIRED');
    expect(multiply('0.0001', '10')).toBe('0.001');
  });
  it('rejects overflow from valid inputs', () => {
    failsWith(
      () => multiply('99999999999999999999', '2'),
      'AMOUNT_OUT_OF_RANGE',
    );
    failsWith(
      () =>
        documentTotal([
          line({ quantity: '1', unitPrice: '99999999999999999999' }),
          line({ itemId: 'item-2', quantity: '1', unitPrice: '1' }),
        ]),
      'AMOUNT_OUT_OF_RANGE',
    );
  });
  it('computes absolute discount, tax and ancillary cost and rejects excessive discount', () => {
    expect(
      lineTotal(
        line({
          quantity: '2.5',
          unitPrice: '10',
          discount: '5',
          tax: '2',
          extraCost: '1',
        }),
      ),
    ).toBe('23');
    failsWith(
      () => lineTotal(line({ discount: '100.0001' })),
      'INVALID_DISCOUNT',
    );
  });
  it('rejects repeated commercial rows and zero quantity', () => {
    failsWith(() => documentTotal([line(), line()]), 'DUPLICATE_ITEM');
    failsWith(
      () => lineTotal(line({ quantity: '0' })),
      'VALIDATION_ERROR',
      'quantity',
    );
  });
});

describe('Submission and policy fail closed', () => {
  it('allows a complete request without mutating its draft', () => {
    const input = draft();
    const before = structuredClone(input);
    expect(() => validateSubmission(input)).not.toThrow();
    expect(input).toEqual(before);
  });
  it.each([
    'title',
    'unitId',
    'purchaseType',
    'category',
    'needReason',
    'requiredAt',
    'deliveryLocation',
  ] as const)('requires %s before submission', (field) => {
    failsWith(
      () => validateSubmission(draft({ [field]: ' ' })),
      'VALIDATION_ERROR',
      field,
    );
  });
  it('requires an urgency reason, unknown-estimate reason and service acceptance criteria', () => {
    failsWith(
      () => validateSubmission(draft({ urgent: true })),
      'VALIDATION_ERROR',
      'urgencyReason',
    );
    failsWith(
      () => validateSubmission(draft({ estimatedAmount: null })),
      'VALIDATION_ERROR',
      'unknownEstimateReason',
    );
    failsWith(
      () =>
        validateSubmission(
          draft({ items: [{ ...draft().items[0]!, kind: 'SERVICE' }] }),
        ),
      'VALIDATION_ERROR',
      'items',
    );
    expect(() =>
      validateSubmission(
        draft({
          estimatedAmount: null,
          unknownEstimateReason: 'Market quote pending',
        }),
      ),
    ).not.toThrow();
  });
  it('retains the draft when no approved policy exists', () => {
    const input = draft();
    const before = structuredClone(input);
    failsWith(
      () => validatePolicy(null, input, 'maker-1'),
      'POLICY_NOT_CONFIGURED',
    );
    expect(input).toEqual(before);
  });
  it.each([
    { branchId: 'other' },
    { unitId: 'other' },
    { currencyCode: 'USD' },
    { category: 'other' },
    { source: '' },
    { version: 0 },
    { approvedAt: 'invalid' },
    { minimumQuotations: 0 },
  ])('rejects unapproved or incompatible policy %j', (changes) => {
    failsWith(
      () => validatePolicy(policy(changes), draft(), 'maker-1'),
      'POLICY_NOT_CONFIGURED',
    );
  });
  it('requires independent and distinct approvers', () => {
    failsWith(
      () => validatePolicy(policy(), draft(), 'checker-1'),
      'NO_VALID_APPROVER',
    );
    failsWith(
      () => validatePolicy(policy({ steps: [] }), draft(), 'maker-1'),
      'NO_VALID_APPROVER',
    );
    failsWith(
      () =>
        validatePolicy(
          policy({ steps: [policy().steps[0]!, policy().steps[0]!] }),
          draft(),
          'maker-1',
        ),
      'NO_VALID_APPROVER',
    );
  });
  it('enforces both policy ceiling and every required approver ceiling', () => {
    expect(() => validatePolicy(policy(), draft(), 'maker-1')).not.toThrow();
    failsWith(
      () =>
        validatePolicy(
          policy(),
          draft({ estimatedAmount: '100.0001' }),
          'maker-1',
        ),
      'APPROVAL_LIMIT_EXCEEDED',
    );
    failsWith(
      () =>
        validatePolicy(
          policy({
            steps: [{ ...policy().steps[0]!, maximumAmount: '99.9999' }],
          }),
          draft(),
          'maker-1',
        ),
      'APPROVAL_LIMIT_EXCEEDED',
    );
  });
  it('rejects missing approver identity and invalid approval permission', () => {
    expect(() =>
      validatePolicy(
        policy({ steps: [{ ...policy().steps[0]!, userId: '' }] }),
        draft(),
        'maker-1',
      ),
    ).toThrow();
    const invalid = {
      ...policy().steps[0]!,
      permission: 'procurement.read.all',
    } as unknown as ApprovalPolicy['steps'][number];
    expect(() =>
      validatePolicy(policy({ steps: [invalid] }), draft(), 'maker-1'),
    ).toThrow();
  });
  it('does not infer authority for emergency or unknown estimates', () => {
    failsWith(
      () =>
        validatePolicy(
          policy(),
          draft({ urgent: true, urgencyReason: 'Urgent replacement' }),
          'maker-1',
        ),
      'EMERGENCY_NOT_AUTHORIZED',
    );
    failsWith(
      () =>
        validatePolicy(policy(), draft({ estimatedAmount: null }), 'maker-1'),
      'ESTIMATE_REQUIRED',
    );
  });
});

describe('Receipt and three-way match', () => {
  it('permits partial receipts through the exact remaining ordered quantity', () => {
    expect(() => assertReceipt('10', '7.5', '2.5', '2', '0.5')).not.toThrow();
    failsWith(
      () => assertReceipt('10', '7.5', '2.5001', '2', '0'),
      'RECEIPT_EXCEEDS_ORDER',
    );
    failsWith(
      () => assertReceipt('10', '0', '2', '1.5', '0.5001'),
      'INVALID_ACCEPTANCE',
    );
  });
  it('matches successive partial invoices only within accepted and ordered balances', () => {
    const accepted = new Map([['item-1', '8']]);
    expect(
      matchInvoice(
        'IRR',
        'IRR',
        [line()],
        accepted,
        new Map([['item-1', '3']]),
        [line({ quantity: '5' })],
      ),
    ).toEqual({ matched: true, issues: [], amount: '50' });
    expect(
      matchInvoice(
        'IRR',
        'IRR',
        [line()],
        accepted,
        new Map([['item-1', '3']]),
        [line({ quantity: '5.0001' })],
      ).issues,
    ).toContainEqual({ itemId: 'item-1', code: 'QUANTITY_MISMATCH' });
    expect(
      matchInvoice(
        'IRR',
        'IRR',
        [line()],
        new Map([['item-1', '20']]),
        new Map(),
        [line({ quantity: '11' })],
      ).matched,
    ).toBe(false);
  });
  it('reports price, currency and unapproved-item differences', () => {
    const result = matchInvoice(
      'IRR',
      'USD',
      [line()],
      new Map([['item-1', '10']]),
      new Map(),
      [line({ unitPrice: '10.0001' }), line({ itemId: 'unknown' })],
    );
    expect(result.matched).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        { itemId: null, code: 'CURRENCY_MISMATCH' },
        { itemId: 'item-1', code: 'PRICE_MISMATCH' },
        { itemId: 'unknown', code: 'ITEM_MISMATCH' },
      ]),
    );
  });
  it('cannot match a service invoice without recorded acceptance', () => {
    const service = line({ itemId: 'service-1', quantity: '1' });
    expect(
      matchInvoice('IRR', 'IRR', [service], new Map(), new Map(), [service])
        .issues,
    ).toContainEqual({ itemId: 'service-1', code: 'QUANTITY_MISMATCH' });
  });
  it('allocates discount, tax and ancillary cost proportionally for partial billing', () => {
    const order = line({ discount: '10', tax: '20', extraCost: '4' });
    const partial = line({
      quantity: '5',
      discount: '5',
      tax: '10',
      extraCost: '2',
    });
    expect(
      matchInvoice(
        'IRR',
        'IRR',
        [order],
        new Map([['item-1', '10']]),
        new Map(),
        [partial],
      ).matched,
    ).toBe(true);
    for (const [field, code] of [
      ['discount', 'DISCOUNT_MISMATCH'],
      ['tax', 'TAX_MISMATCH'],
      ['extraCost', 'EXTRACOST_MISMATCH'],
    ] as const) {
      expect(
        matchInvoice(
          'IRR',
          'IRR',
          [order],
          new Map([['item-1', '10']]),
          new Map(),
          [{ ...partial, [field]: '0' }],
        ).issues,
      ).toContainEqual({ itemId: 'item-1', code });
    }
  });
});

describe('Supplier invoice duplicate identity normalization', () => {
  it.each([' inv-۱۲۳ ', 'INV-١٢٣', 'ＩＮＶ-１２３', 'in v-1 2 3'])(
    'identifies equivalent invoice number %s',
    (input) => {
      expect(normalizeInvoiceNumber(input)).toBe('INV-123');
    },
  );
  it.each(['', ' \t\n', '\u200b\u200c\u200d', '\u0000\u001f'])(
    'rejects empty and nonprinting-only invoice identity %j',
    (input) => {
      failsWith(() => normalizeInvoiceNumber(input), 'VALIDATION_ERROR');
    },
  );
  it('prevents invisible-character bypass of a duplicate invoice identity', () => {
    expect(normalizeInvoiceNumber('INV-\u200b1\u200c2\u200d3')).toBe('INV-123');
  });
});
