import type { TourDepartureV1, TourPackageV1 } from '@nora/contracts';
import { expect, it, vi } from 'vitest';
import {
  readTourGuideStatus,
  renderTourGuide,
  resolveTourGuideQuestion,
  tourGuideDestination,
} from './tour-guide';

const id = '11111111-1111-4111-8111-111111111111';
const branch = '22222222-2222-4222-8222-222222222222';
const scope = {
  branchIds: [branch],
  permissions: ['ticket_catalog.tours.manage'],
};
const tour: TourPackageV1 = {
  id,
  branchId: branch,
  version: 1,
  createdAt: '2026-11-21T00:00:00Z',
  name: 'تور نمونه',
  publicationStatus: 'DRAFT',
  originId: 'origin',
  destinationId: 'destination',
  hotelIds: [],
  visa: false,
  transferOutbound: false,
  transferReturn: false,
  details: { version: 1, isFloating: true, isCombined: true },
};
const period = {
  id: 'period',
  branchId: branch,
  packageId: id,
  package: tour,
  startsOn: '2026-11-22',
  endsOn: '2026-11-27',
  isActive: false,
  outbound: { totalCapacity: 8 },
  returning: { totalCapacity: 3 },
  remainingCapacity: 9,
} as TourDepartureV1;
const signal = new AbortController().signal;

it.each([
  ['راهنمای تعریف تور و خدمات', 'overview'],
  ['چطور تور جدید تعریف کنم؟', 'create'],
  ['چطور تور شناور بسازم؟', 'floating'],
  ['برنامه سفر تور ترکیبی کجاست؟', 'details'],
  ['چطور تور را ویرایش کنم؟', 'edit'],
  ['نوبت تور را چطور برای هفته بعد تکرار کنم؟', 'departure'],
  ['هتل‌های این بازه کجاست؟', 'hotel'],
  ['چطور نرخ تور شناور را ثبت کنم؟', 'price'],
  ['انتشار تور در سایت از کجاست؟', 'website'],
  ['چطور بازه تور را متوقف کنم؟', 'period'],
] as const)('routes %s to %s and preserves follow-up', (question, topic) => {
  expect(resolveTourGuideQuestion(question, true)).toMatchObject({
    kind: 'guide',
    topic,
  });
  expect(resolveTourGuideQuestion('بعدش چی؟', true, topic)).toMatchObject({
    kind: 'guide',
    topic,
    followUp: true,
  });
  expect(renderTourGuide(topic, true)).toContain('تعریف تور و خدمات');
});

it('lets contract and reservation workflows keep their routes and clarifies ambiguous visibility', () => {
  expect(
    resolveTourGuideQuestion('چطور از تور قرارداد بزنم؟', true),
  ).toBeUndefined();
  expect(
    resolveTourGuideQuestion('چطور گزارش رزرواسیون را ببینم؟', true),
  ).toBeUndefined();
  expect(resolveTourGuideQuestion('این تور چرا نمیاد؟', true)).toMatchObject({
    kind: 'clarify',
  });
  expect(
    resolveTourGuideQuestion('چطور نرخ تور شناور را ثبت کنم؟', false),
  ).toMatchObject({ kind: 'guide', topic: 'price', floatingPrice: true });
  expect(tourGuideDestination('price', true)).toBe('/sales/pricing/floating');
  expect(tourGuideDestination('hotel')).toBe('/reservations/hotel-rates');
  expect(tourGuideDestination('website')).toBe('/integrations');
});

function read(question: string) {
  const result = resolveTourGuideQuestion(question, true);
  if (result?.kind !== 'record') throw new Error('Expected tour record intent');
  return result;
}

it('shows recorded definition and clamps seats using both offer capacities', async () => {
  const api = {
    packages: vi.fn().mockResolvedValue({ data: [tour] }),
    departures: vi.fn().mockResolvedValue({ data: [period] }),
  };
  const result = await readTourGuideStatus(
    read('وضعیت تور «تور نمونه» در 2026-11-22'),
    scope,
    signal,
    api,
    new Date('2026-11-21'),
  );
  expect(api.departures).toHaveBeenCalledWith(true, signal);
  expect(result.text).toContain('پیش‌نویس');
  expect(result.text).toContain('تور شناور');
  expect(result.text).toContain('۳ / ۳');
  expect(result.text).toContain('بازه متوقف');
  expect(result.href).toBe('/sales/pricing/floating?tour=' + id);
});

it('does not resolve duplicate names or records outside the branch scope', async () => {
  const question = read('وضعیت تور «تور نمونه»');
  const api = {
    packages: vi
      .fn()
      .mockResolvedValue({ data: [tour, { ...tour, id: 'duplicate' }] }),
    departures: vi.fn(),
  };
  expect(
    (await readTourGuideStatus(question, scope, signal, api)).text,
  ).toContain('چند تور');
  expect(
    (
      await readTourGuideStatus(
        question,
        { ...scope, branchIds: ['other'] },
        signal,
        api,
      )
    ).text,
  ).toContain('پیدا نشد');
  expect(api.departures).not.toHaveBeenCalled();
});

it('distinguishes legacy publication, no departure, and cancelled request', async () => {
  const question = read('وضعیت تور ' + id);
  const api = {
    packages: vi
      .fn()
      .mockResolvedValue({
        data: [{ ...tour, publicationStatus: undefined, details: undefined }],
      }),
    departures: vi.fn().mockResolvedValue({ data: [] }),
  };
  const result = await readTourGuideStatus(
    question,
    { ...scope, permissions: [] },
    signal,
    api,
  );
  expect(result.text).toContain('منتشرشده');
  expect(result.text).toContain('نوبتی با این شرایط');
  expect(api.departures).toHaveBeenCalledWith(false, signal);
  const controller = new AbortController();
  controller.abort();
  await expect(
    readTourGuideStatus(question, scope, controller.signal, api),
  ).rejects.toMatchObject({ name: 'AbortError' });
});
