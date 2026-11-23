import test from 'node:test';
import assert from 'node:assert/strict';
import { hotelRankingRequest, renderHotelRanking } from './hotel-ranking.mjs';

test('hotel ranking uses Tehran month boundaries and preserves explicit filters', () => {
  const now = new Date('2026-11-23T08:00:00Z');
  const example = 'پرفروش ترین هتل های یک ماه اخیر به تفکیک کشور ها بنویس';
  assert.deepEqual(hotelRankingRequest(example, now), {
    startUtc: '2026-10-23T20:30:00.000Z',
    endExclusiveUtc: '2026-11-23T08:00:00.000Z',
    partial: true,
  });
  assert.equal(
    hotelRankingRequest(example.replace('هتل های', 'هتل های شعبه الف در'), now),
    null,
  );
  assert.equal(
    hotelRankingRequest('پرفروش‌ترین هتل‌های ماه قبل به تفکیک کشور', now)
      ?.endExclusiveUtc,
    '2026-11-21T20:30:00.000Z',
  );
});

test('rendered ranking cites evidence and discloses missing labels', () => {
  const now = new Date('2026-11-23T08:00:00Z');
  const period = hotelRankingRequest(
    'پرفروش‌ترین هتل‌های این ماه به تفکیک کشور',
    now,
  );
  const resultId = '12345678-1234-4234-8234-123456789abc';
  const report = renderHotelRanking(
    {
      rows: [{ hotel: 'Hotel A', country: 'کشور الف', count: 2 }],
      resultId,
      observedAt: now.toISOString(),
      missing: 1,
      truncated: false,
    },
    period,
    resultId,
  );
  assert.match(report.text, /Hotel A \| ۲/);
  assert.equal(report.sources[0].resultId, resultId);
  assert.match(report.limitations[0], /فاقد نام/);
});
