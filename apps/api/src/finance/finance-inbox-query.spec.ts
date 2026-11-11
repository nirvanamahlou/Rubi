import { describe, expect, it } from 'vitest';
import type { AuthenticatedActor, FinanceInboxItemV1 } from '@nora/contracts';
import {
  compareFinanceQueueOrder,
  decimalUnits,
  filterFinanceInbox,
  selectFinanceInboxPage,
  validateInboxQuery,
} from './finance-inbox-query';
const actor = { branchIds: ['branch-a'] } as AuthenticatedActor;
const item = {
  id: 'case',
  source: 'HR',
  kind: 'PAYROLL_REQUEST',
  status: 'APPROVED',
  branchReference: 'branch-a',
  title: 'حقوق کارکنان',
  partyDisplaySnapshot: 'علی كريمی',
  amount: { amount: '9007199254740993.125', currencyCode: 'IRR' },
  createdAt: '2026-10-03T20:30:00.000Z',
  dueAt: '2026-10-05T20:29:59.999Z',
} as FinanceInboxItemV1;
describe('Exact Finance inbox filters', () => {
  it('distinguishes purchases across sending units from receipt verification before pagination/export', () => {
    const reservation = {
      ...item,
      id: 'reservation',
      kind: 'PAYMENT_REQUEST',
      source: 'RESERVATIONS',
    } as FinanceInboxItemV1;
    const purchase = {
      ...reservation,
      id: 'purchase',
      source: 'PURCHASES',
    } as FinanceInboxItemV1;
    const receipt = {
      ...item,
      id: 'receipt',
      kind: 'RECEIPT_VERIFICATION',
      source: 'SALES',
    } as FinanceInboxItemV1;
    expect(
      filterFinanceInbox([reservation, purchase, receipt, item], {
        category: 'PURCHASE',
      }).map((r) => r.id),
    ).toEqual(['purchase', 'reservation']);
    expect(
      filterFinanceInbox([reservation, purchase, receipt, item], {
        category: 'RECEIPT',
      }).map((r) => r.id),
    ).toEqual(['receipt']);
    expect(
      filterFinanceInbox([reservation, purchase, receipt], {
        category: 'PURCHASE',
        source: 'RESERVATIONS',
      }).map((r) => r.id),
    ).toEqual(['reservation']);
    expect(() =>
      validateInboxQuery({ category: 'UNKNOWN' as never }, actor),
    ).toThrow();
    expect(() =>
      validateInboxQuery({ category: ['PURCHASE'] as never }, actor),
    ).toThrow();
  });
  it('keeps approved payroll open for payment but closes completed HR referrals', () => {
    expect(filterFinanceInbox([item], { status: 'OPEN' })).toHaveLength(1);
    expect(
      filterFinanceInbox([{ ...item, kind: 'HR_REFERRAL' }], {
        status: 'CLOSED',
      }),
    ).toHaveLength(1);
  });
  it('filters exact large decimal money, person normalization, branch, currency and Tehran day boundaries', () => {
    expect(
      filterFinanceInbox([item], {
        person: 'کریم',
        branchId: 'branch-a',
        currencyCode: 'IRR',
        minAmount: '9007199254740993.125',
        maxAmount: '9007199254740993.125',
        fromDate: '2026-10-04',
        toDate: '2026-10-04',
        dueFrom: '2026-10-05',
        dueTo: '2026-10-05',
      }),
    ).toHaveLength(1);
    expect(
      filterFinanceInbox([item], { maxAmount: '9007199254740993.1249' }),
    ).toHaveLength(0);
    expect(decimalUnits('9007199254740993.125')).toBe(
      900719925474099312500000n,
    );
  });
  it.each([
    { minAmount: '-1' },
    { minAmount: '1e5' },
    { minAmount: '20', maxAmount: '10' },
    { fromDate: '2026-02-30' },
    { pageSize: 101 },
    { page: 0 },
    { status: 'UNKNOWN' },
    { currencyCode: 'irr' },
    { sortBy: 'unknown' },
    { sortDirection: 'random' },
    { sortBy: ['amount'] },
  ])('rejects invalid filter %s', (query) => {
    expect(() => validateInboxQuery(query as never, actor)).toThrow();
  });
  it('rejects unauthorized branch filters', () => {
    expect(() => validateInboxQuery({ branchId: 'branch-b' }, actor)).toThrow();
  });
});

describe('Finance inbox ordering before pagination', () => {
  const row = (
    id: string,
    amount: string | null,
    dueAt: string | null,
    createdAt = item.createdAt,
  ) => ({
    ...item,
    id,
    amount: amount === null ? null : { amount, currencyCode: 'IRR' },
    dueAt,
    createdAt,
  });
  const rows = [
    row('large', '9007199254740993.1251', '2026-10-07T00:00:00Z'),
    row('small', '9007199254740993.125', '2026-10-05T00:00:00Z'),
    row('missing', null, null),
  ];
  it.each(['asc', 'desc'] as const)(
    'sorts exact decimal amounts %s, keeping missing amounts last',
    (sortDirection) => {
      expect(
        filterFinanceInbox(rows, { sortBy: 'amount', sortDirection }).map(
          (r) => r.id,
        ),
      ).toEqual(
        sortDirection === 'asc'
          ? ['small', 'large', 'missing']
          : ['large', 'small', 'missing'],
      );
    },
  );
  it.each(['asc', 'desc'] as const)(
    'sorts due dates %s, keeping requests without due dates last',
    (sortDirection) => {
      expect(
        filterFinanceInbox(rows, { sortBy: 'dueAt', sortDirection }).map(
          (r) => r.id,
        ),
      ).toEqual(
        sortDirection === 'asc'
          ? ['small', 'large', 'missing']
          : ['large', 'small', 'missing'],
      );
    },
  );
  it('retains newest-first default and supports oldest-first arrival ordering', () => {
    const dates = [
      row('early', '1', null, '2026-10-01T12:00:00Z'),
      row('late', '2', null, '2026-10-02T12:00:00Z'),
    ];
    expect(filterFinanceInbox(dates, {}).map((r) => r.id)).toEqual([
      'late',
      'early',
    ]);
    expect(
      filterFinanceInbox(dates, {
        sortBy: 'createdAt',
        sortDirection: 'asc',
      }).map((r) => r.id),
    ).toEqual(['early', 'late']);
  });
  it('groups monetary sorting by currency rather than treating distinct currencies as comparable', () => {
    const usd = {
      ...row('usd', '1', null),
      amount: { amount: '1', currencyCode: 'USD' },
    };
    expect(
      filterFinanceInbox([usd, ...rows], {
        sortBy: 'amount',
        sortDirection: 'asc',
      }).map((r) => r.id),
    ).toEqual(['small', 'large', 'usd', 'missing']);
  });
  it('sorts the complete result before slicing a page and uses stable IDs for equal values', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      row(String(i).padStart(2, '0'), String(30 - i), null),
    );
    expect(
      filterFinanceInbox(many, { sortBy: 'amount', sortDirection: 'asc' })
        .slice(0, 2)
        .map((r) => r.id),
    ).toEqual(['29', '28']);
    expect(
      filterFinanceInbox([row('b', '1', null), row('a', '1', null)], {
        sortBy: 'amount',
      }).map((r) => r.id),
    ).toEqual(['a', 'b']);
  });
});

describe('bounded Finance inbox page selection', () => {
  const generatedAt = '2026-10-08T00:00:00Z';

  it.each(['createdAt', 'dueAt', 'amount'] as const)(
    'matches full ordering for %s across shallow, deep and empty pages',
    (sortBy) => {
      const rows: FinanceInboxItemV1[] = Array.from(
        { length: 112 },
        (_, index) => ({
          ...item,
          id: String(index % 29),
          description: String(index),
          branchReference: index % 6 ? 'branch-a' : 'branch-b',
          createdAt: `2026-10-0${(index % 4) + 1}T00:00:00Z`,
          dueAt: index % 4 ? `2026-10-0${(index % 6) + 2}T00:00:00Z` : null,
          amount:
            index % 3
              ? {
                  amount: `9007199254740993.${(index % 17) + 10}`,
                  currencyCode: index % 2 ? 'IRR' : 'USD',
                }
              : null,
        }),
      );
      for (const sortDirection of ['asc', 'desc'] as const) {
        const query = {
          sortBy,
          sortDirection,
          branchId: 'branch-a',
          person: 'کریمی',
        };
        const expected = filterFinanceInbox(
          [...rows].sort(compareFinanceQueueOrder),
          query,
        );
        for (const page of [1, 2, 7, 14, 30]) {
          const selected = selectFinanceInboxPage(
            rows,
            query,
            page,
            7,
            generatedAt,
          );
          expect(selected.items).toEqual(
            expected.slice((page - 1) * 7, page * 7),
          );
          expect(selected.total).toBe(expected.length);
        }
      }
    },
  );

  it('computes summary over all matching rows, including rows outside the page', () => {
    const rows: FinanceInboxItemV1[] = [
      { ...item, id: 'payment', direction: 'PAYMENT', status: 'PAYING' },
      {
        ...item,
        id: 'receipt',
        source: 'SALES',
        kind: 'RECEIPT_VERIFICATION',
        status: 'NEW',
      },
      {
        ...item,
        id: 'return',
        source: 'FINANCE',
        direction: 'RECEIPT',
        status: 'NEW',
        dueAt: null,
      },
      { ...item, id: 'non-cash', direction: 'NON_CASH', dueAt: generatedAt },
      { ...item, id: 'paid', direction: 'PAYMENT', status: 'PAID' },
      { ...item, id: 'other-branch', branchReference: 'branch-b' },
    ];
    expect(
      selectFinanceInboxPage(rows, { branchId: 'branch-a' }, 9, 1, generatedAt),
    ).toEqual({
      items: [],
      total: 5,
      summary: {
        openCount: 4,
        overdueCount: 2,
        receiptCount: 2,
        paymentCount: 1,
      },
    });
  });
});

describe('Finance approval groups', () => {
  it('moves a confirmed receipt out of pending and includes it in approved with matching exports', () => {
    const pending = {
      ...item,
      id: 'pending',
      kind: 'RECEIPT_VERIFICATION',
      source: 'SALES',
      status: 'NEW',
    } as FinanceInboxItemV1;
    const confirmed = {
      ...pending,
      id: 'confirmed',
      status: 'RECEIPT_CONFIRMED',
    } as FinanceInboxItemV1;
    expect(
      filterFinanceInbox([pending, confirmed], {
        approvalGroup: 'PENDING',
      }).map((r) => r.id),
    ).toEqual(['pending']);
    expect(
      filterFinanceInbox([pending, confirmed], {
        approvalGroup: 'APPROVED',
      }).map((r) => r.id),
    ).toEqual(['confirmed']);
    expect(
      filterFinanceInbox([confirmed], {
        approvalGroup: 'APPROVED',
        search: 'missing',
      }),
    ).toEqual([]);
  });
  it.each([
    'NEW',
    'UNDER_REVIEW',
    'CORRECTION_REQUIRED',
    'REJECTED',
    'CANCELLED',
    'RETURNED',
  ] as const)('keeps %s outside approved', (status) => {
    expect(
      filterFinanceInbox([{ ...item, status }], { approvalGroup: 'APPROVED' }),
    ).toEqual([]);
  });
  it.each([
    'APPROVED',
    'READY_FOR_PAYMENT',
    'PAYING',
    'PAID',
    'RECEIPT_CONFIRMED',
  ] as const)('retains %s in approved', (status) => {
    expect(
      filterFinanceInbox([{ ...item, status }], { approvalGroup: 'APPROVED' }),
    ).toHaveLength(1);
  });
  it.each(['unknown', ['PENDING'], null])(
    'rejects malformed approval group %s',
    (approvalGroup) => {
      expect(() =>
        validateInboxQuery({ approvalGroup } as never, actor),
      ).toThrow();
    },
  );
});

it('keeps reservation handoffs awaiting Finance despite their ready-for-payment state', () => {
  const request = {
    ...item,
    source: 'RESERVATIONS',
    status: 'READY_FOR_PAYMENT',
  } as FinanceInboxItemV1;
  expect(
    filterFinanceInbox([request], { approvalGroup: 'PENDING' }),
  ).toHaveLength(1);
  expect(
    filterFinanceInbox([request], { approvalGroup: 'APPROVED' }),
  ).toHaveLength(0);
  expect(
    filterFinanceInbox([{ ...request, status: 'PAYING' }], {
      approvalGroup: 'APPROVED',
    }),
  ).toHaveLength(1);
});
