import { expect, it, vi } from 'vitest';
import { ReservationReportHttpError } from '@/modules/ticket-catalog/api/issued-tickets';
import {
  initialIssuedTicketQuery,
  type IssuedTicketReadModel,
} from '@/modules/ticket-catalog/model/issued-tickets';
import {
  readReservationReportAnswer,
  resolveReservationReportQuestion,
} from './reservation-report-guide';

const row: IssuedTicketReadModel = {
  id: '1',
  contractNumber: '120001',
  passengerDisplayName: 'PRIVATE',
  ticketNumber: '90001',
  pnr: 'ABCD',
  originCityId: 'a',
  origin: 'تهران',
  destinationCityId: 'b',
  destination: 'تبریز',
  airlineId: 'carrier',
  airline: 'نمونه',
  issuedAt: '2026-11-21T10:00:00Z',
  departureAt: '2026-11-25T10:00:00Z',
  status: 'issued',
  reportStatus: 'ISSUED',
  serviceKind: 'FLIGHT',
};
const snapshot = {
  query: {
    ...initialIssuedTicketQuery,
    issuedFrom: '2026-11-21',
    issuedTo: '2026-11-21',
    page: 2,
  },
  rows: [
    row,
    {
      ...row,
      id: '2',
      status: 'allocated' as const,
      reportStatus: 'ALLOCATED',
      ticketNumber: '',
    },
    {
      ...row,
      id: '3',
      status: 'voided' as const,
      reportStatus: 'CANCELLED',
      originCityId: 'b',
      origin: 'تبریز',
      destinationCityId: 'a',
      destination: 'تهران',
    },
    { ...row, id: '4', serviceKind: 'HOTEL' },
  ],
  state: 'ready' as const,
};
const signal = new AbortController().signal;

function read(question: string) {
  const intent = resolveReservationReportQuestion(question, true);
  if (intent?.kind !== 'read') throw Error('Expected report read');
  return intent;
}

it.each([
  ['چطور گزارش رزرواسیون را بسازم؟', 'start'],
  ['مبنای تاریخ گزارش رزرواسیون چیه؟', 'dates'],
  ['چطور استردادها را ببینم؟', 'filters'],
  ['اختلاف عدد کارت‌ها چیه؟', 'cards'],
  ['چطور ردیف تخصیص یافته را بخوانم؟', 'rows'],
  ['چطور PDF دانلود کنم؟', 'exports'],
] as const)('routes %s to %s', (question, topic) => {
  expect(resolveReservationReportQuestion(question, true)).toMatchObject({
    kind: 'guide',
    topic,
  });
  expect(
    resolveReservationReportQuestion('بعدش چی؟', true, topic),
  ).toMatchObject({ kind: 'guide', topic, followUp: true });
});

it.each([
  ['تعداد خدمات همین گزارش', 'تعداد خدمات · ۳'],
  ['تعداد فعال و تغییریافته', 'فعال و تغییریافته · ۱'],
  ['تعداد استرداد یا ابطال', 'استرداد یا ابطال · ۱'],
  ['چند مسیر داریم؟', 'تعداد مسیرها · ۲'],
  ['چند بلیت صادر شده؟', 'ردیف‌های پرواز دارای سند صدور قابل مشاهده · ۱'],
  ['جمع قطعه پرواز در هر مسیر', 'تهران ← تبریز · ۲'],
  ['هفته قبل چند استرداد داشتیم؟', 'جداگانه مشخص نمی‌کند'],
])('matches panel semantics for %s', async (question, expected) => {
  const load = vi.fn();
  expect(
    await readReservationReportAnswer(
      read(question),
      snapshot,
      signal,
      Date.now(),
      load,
    ),
  ).toContain(expected);
  expect(load).not.toHaveBeenCalled();
});

it('requests an explicit date basis without live panel context and uses authorized reads', async () => {
  const load = vi.fn().mockResolvedValue({ data: [row] });
  const intent = read('تعداد خدمات از 2026-11-21 تا 2026-11-21 به مبنای صدور');
  expect(
    await readReservationReportAnswer(
      intent,
      undefined,
      signal,
      Date.now(),
      load,
    ),
  ).toContain('تعداد خدمات · ۱');
  expect(load).toHaveBeenCalledWith(
    signal,
    expect.objectContaining({
      issuedFrom: '2026-11-21',
      issuedTo: '2026-11-21',
      dateBasis: 'ISSUED',
    }),
  );
  load.mockRejectedValue(new ReservationReportHttpError('private', 403));
  expect(
    await readReservationReportAnswer(
      intent,
      undefined,
      signal,
      Date.now(),
      load,
    ),
  ).toContain('مجوز مشاهده');
});

it('does not pick a row from repeated PNR or expose passenger names', async () => {
  const intent = read('وضعیت بلیت PNR ABCD');
  const load = vi.fn().mockResolvedValue({ data: snapshot.rows });
  expect(
    await readReservationReportAnswer(
      intent,
      snapshot,
      signal,
      Date.now(),
      load,
    ),
  ).toContain('چند نتیجه');
  load.mockResolvedValue({ data: [row] });
  const answer = await readReservationReportAnswer(
    intent,
    snapshot,
    signal,
    Date.now(),
    load,
  );
  expect(answer).toContain('صادرشده');
  expect(answer).not.toContain('PRIVATE');
});

it('does not make up a count for a date that differs from the applied report', () => {
  expect(
    resolveReservationReportQuestion('دیروز چند خدمت داشتیم؟', true),
  ).toMatchObject({ kind: 'clarify' });
  expect(
    resolveReservationReportQuestion('چطور قرارداد جدید ثبت کنم؟', true),
  ).toBeUndefined();
});

it('does not publish a late result after the report context changes', async () => {
  const controller = new AbortController();
  const load = vi.fn(async () => {
    controller.abort();
    return { data: [row], options: undefined };
  });
  const intent = read('تعداد خدمات از 2026-11-21 به مبنای صدور');
  await expect(
    readReservationReportAnswer(
      intent,
      undefined,
      controller.signal,
      Date.now(),
      load,
    ),
  ).rejects.toMatchObject({ name: 'AbortError' });
});
