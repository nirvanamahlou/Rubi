import { describe, expect, it, vi } from 'vitest';
import { loadPurchaseInbox } from '../reservation-purchases/api';
import { readPurchaseGuide, resolvePurchaseQuestion } from './purchase-guides';

vi.mock('../reservation-purchases/api', () => ({ loadPurchaseInbox: vi.fn() }));

describe('Purchase guidance', () => {
  it.each([
    ['کارت داشبورد خرید و تامین', 'dashboard'],
    ['فیلتر تاریخ خرید و تامین', 'filters'],
    ['خرید هتل چطور ثبت میشه', 'save'],
    ['قیمت صندلی کجاست', 'flight'],
    ['چرا تسویه مالی خرید انجام نشده', 'finance'],
    ['چرا دکمه ثبت خرید ندارم', 'access'],
  ])('routes %s', (question, id) => {
    expect(resolvePurchaseQuestion(question, true)).toMatchObject({
      topic: { id },
    });
  });
  it('preserves adjacent topics and continues a purchase guide', () => {
    expect(
      resolvePurchaseQuestion('تنخواه را از کجا ثبت کنم', true),
    ).toBeUndefined();
    expect(
      resolvePurchaseQuestion('قیمت فروش قرارداد چقدر است', true),
    ).toBeUndefined();
    expect(resolvePurchaseQuestion('بعدش چی؟', false, 'save')).toMatchObject({
      topic: { id: 'save' },
    });
  });
  it('requests a full code and avoids reading until it is supplied', async () => {
    vi.mocked(loadPurchaseInbox).mockClear();
    const signal = new AbortController().signal;
    expect(
      resolvePurchaseQuestion('وضعیت خرید قرارداد ۱۲۳ چیست', true),
    ).toMatchObject({ kind: 'status', code: '123' });
    expect((await readPurchaseGuide(undefined, signal)).text).toContain(
      'شماره کامل',
    );
    expect(loadPurchaseInbox).not.toHaveBeenCalled();
  });
  it('uses authorized inbox results and avoids substring and partial-page claims', async () => {
    const signal = new AbortController().signal;
    const result = {
      data: [
        {
          id: 'authorized',
          snapshot: {
            contractNumber: 'AB-12',
            serviceSelections: [
              { kind: 'HOTEL', clientKey: 'h', titleSnapshot: 'هتل' },
            ],
            selectedTicketOfferIds: [],
          },
          servicePurchases: [
            {
              version: 1,
              serviceClientKey: 'h',
              finance: { status: 'REJECTED' },
            },
          ],
        },
      ],
      meta: {
        hasMore: false,
        services: [{ id: 'authorized', clientKey: 'h', status: 'REGISTERED' }],
      },
    } as unknown as Awaited<ReturnType<typeof loadPurchaseInbox>>;
    vi.mocked(loadPurchaseInbox).mockResolvedValue(result);
    expect(await readPurchaseGuide('ab-12', signal)).toMatchObject({
      text: expect.stringContaining('نیازمند اصلاح خرید'),
      link: { href: expect.stringContaining('reservationId=authorized') },
    });
    expect(await readPurchaseGuide('AB-1', signal)).toMatchObject({
      link: { href: '/ticket-purchases' },
    });
    vi.mocked(loadPurchaseInbox).mockResolvedValue({
      ...result,
      meta: { ...result.meta, hasMore: true },
    });
    expect(await readPurchaseGuide('AB-12', signal)).toMatchObject({
      link: { href: '/ticket-purchases' },
    });
    expect(loadPurchaseInbox).toHaveBeenCalledWith(
      'ALL',
      1,
      'AB-12',
      signal,
      expect.objectContaining({ status: 'ALL' }),
    );
  });
});
