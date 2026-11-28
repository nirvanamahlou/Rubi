import type { FinanceCustomerDocumentDeliveryCandidateV1 } from '@nora/contracts';
import { expect, it, vi } from 'vitest';
import { FinanceInboxApiError } from '@/modules/finance/api/finance-inbox-api';
import { financeRouteNeedsYear } from '@/modules/finance/components/finance-fiscal-boundary';
import { assistantGuideCatalogues } from './assistant-guide-registry';
import {
  readFinanceDeliveryStatus,
  renderFinanceDeliveryGuide,
  resolveFinanceDeliveryQuestion,
} from './finance-delivery-guide';

const row: FinanceCustomerDocumentDeliveryCandidateV1 = {
  contractId: 'contract',
  contractNumber: 'SC-2026-000001',
  branchId: 'branch',
  customerNameSnapshot: 'PRIVATE CUSTOMER',
  settlementStatus: 'PARTIALLY_SETTLED',
  hasConfirmedPayment: true,
  delivery: {
    version: 1,
    approved: true,
    basis: 'MANAGER_EXCEPTION',
    reason: 'PRIVATE AUDIT',
    exceptionExpiresAt: '2026-11-20T00:00:00.000Z',
    updatedAt: null,
    updatedByUserId: 'PRIVATE USER',
  },
};

it.each([
  ['شماره قرارداد را کجا پیدا کنم؟', 'search'],
  ['راهنمای وضعیت مجوز تحویل مدارک', 'status'],
  ['چطور مجوز تحویل مدارک صادر کنم؟', 'issue'],
  ['چرا با وجود رسید تحویل مدارک بسته است؟', 'receipt'],
  ['برای تحویل مدارک تسویه کامل لازم است؟', 'settlement'],
  ['استثنای مدیر چطوری ثبت میشه؟', 'exception'],
  ['مجوز رزرواسیون چطور ثبت میشه؟', 'reservation'],
  ['چطور مجوز را لغو کنم؟', 'revoke'],
] as const)('routes %s to %s', (message, topic) => {
  expect(resolveFinanceDeliveryQuestion(message, true)).toMatchObject({
    kind: 'guide',
    topic,
  });
  expect(resolveFinanceDeliveryQuestion('بعدش چی؟', true, topic)).toMatchObject(
    { kind: 'guide', topic, followUp: true },
  );
  expect(renderFinanceDeliveryGuide(topic, true)).toContain(
    'مالی ← تحویل مدارک',
  );
  const entry = assistantGuideCatalogues['finance-delivery'].topics.find(
    (item) => item.id === topic,
  )!;
  const answer = renderFinanceDeliveryGuide(topic, false);
  for (const step of entry.steps) expect(answer).toContain(step);
  expect(renderFinanceDeliveryGuide(topic, true)).toContain(entry.steps.at(-1));
});

it('describes the fiscal context at each protected destination, including the receipt inbox', () => {
  const receipt = assistantGuideCatalogues['finance-delivery'].topics.find(
    (item) => item.id === 'customer-receipt',
  )!;
  expect(receipt.href).toBe('/finance/requests');
  expect(financeRouteNeedsYear('/finance')).toBe(false);
  const entries = Object.values(assistantGuideCatalogues).flatMap((module) =>
    module.topics.filter(({ href }) =>
      ['/finance/requests', '/finance/delivery'].includes(href),
    ),
  );
  expect(entries).toHaveLength(11);
  for (const entry of entries) {
    expect(financeRouteNeedsYear(entry.href)).toBe(true);
    expect(entry.steps[0]).toContain('همه شرکت‌ها');
    expect(entry.steps[0]).toContain('یک شرکت');
    expect(entry.steps[0]).toContain('سال مالی پیش‌فرض شرکت');
  }
  expect(
    assistantGuideCatalogues.reporting.topics.find(
      ({ id }) => id === 'delivery',
    )?.href,
  ).toBe('/reports');
});

it('keeps uploads and sales registration in their own guides', () => {
  expect(
    resolveFinanceDeliveryQuestion('مدرک قرارداد را کجا بارگذاری کنم؟', true),
  ).toBeUndefined();
  expect(
    resolveFinanceDeliveryQuestion('چطور ثبت قرارداد انجام بدم؟', true),
  ).toBeUndefined();
  expect(
    resolveFinanceDeliveryQuestion('مدارک مشتری رو می‌تونم تحویل بدم؟', true),
  ).toMatchObject({ kind: 'clarify' });
  expect(
    resolveFinanceDeliveryQuestion(
      'وضعیت مجوز تحویل مدارک sc-۲۰۲۶-۰۰۰۰۰۱',
      false,
    ),
  ).toEqual({ kind: 'record', number: 'sc-2026-000001' });
});

it('reports expiry, settlement and confirmation without exposing restricted fields', async () => {
  const signal = new AbortController().signal;
  const lookup = vi.fn().mockResolvedValue([row]);
  const answer = await readFinanceDeliveryStatus(
    'sc-2026-000001',
    signal,
    lookup,
    Date.parse('2026-11-21'),
  );
  expect(lookup).toHaveBeenCalledWith('sc-2026-000001', signal);
  expect(answer).toContain('منقضی');
  expect(answer).toContain('بخشی تسویه شده');
  expect(answer).toContain('دریافت تأییدشده دارد');
  expect(answer).not.toContain('PRIVATE');
});

it('distinguishes ambiguous, inaccessible and unavailable results', async () => {
  const signal = new AbortController().signal;
  const lookup = vi.fn().mockResolvedValue([row]);
  expect(await readFinanceDeliveryStatus('sc-2026', signal, lookup)).toContain(
    'شمارهٔ کامل',
  );
  lookup.mockResolvedValue([]);
  const absent = await readFinanceDeliveryStatus(
    'sc-2026-000001',
    signal,
    lookup,
  );
  lookup.mockRejectedValue(new FinanceInboxApiError('private', 403));
  expect(
    await readFinanceDeliveryStatus('sc-2026-000001', signal, lookup),
  ).toBe(absent);
  lookup.mockRejectedValue(new Error('private'));
  expect(
    await readFinanceDeliveryStatus('sc-2026-000001', signal, lookup),
  ).toContain('خواندن وضعیت مجوز انجام نشد');
});

it('discards a result after navigation or session cancellation', async () => {
  const controller = new AbortController();
  const lookup = vi.fn(async () => {
    controller.abort();
    return [row];
  });
  await expect(
    readFinanceDeliveryStatus('sc-2026-000001', controller.signal, lookup),
  ).rejects.toMatchObject({ name: 'AbortError' });
});
