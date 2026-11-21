import { describe, expect, it, vi } from 'vitest';
import { MasterDataApiError, masterDataApi } from '../master-data/api/client';
import { masterDataSections } from '../master-data/model/sections';
import {
  masterDataGuideTopics,
  readMasterDataGuide,
  resolveMasterDataQuestion,
} from './master-data-guide';

const signal = new AbortController().signal;
const record = {
  id: 'private-id',
  resource: 'airports',
  name: 'فرودگاه نمونه',
  code: 'ABC',
  version: 1,
  status: 'inactive',
  attributes: { phone: 'private' },
  createdAt: '',
  updatedAt: '',
} as const;
const query = resolveMasterDataQuestion(
  'وضعیت فرودگاه کد ABC چیست؟',
  '/master-data/geography',
);
if (query?.kind !== 'read') throw new Error('Expected a master data lookup');

describe('Master data guidance', () => {
  it('covers all navigable resources and links back to their actual workspace', () => {
    expect(masterDataGuideTopics.map(({ id }) => id)).toEqual(
      masterDataSections.flatMap(({ resources }) => resources),
    );
    for (const topic of masterDataGuideTopics) {
      expect(topic.text.length).toBeGreaterThan(0);
      expect(
        resolveMasterDataQuestion('بعدش چی؟', '/', topic.id),
      ).toMatchObject({
        href: '/master-data/' + topic.section,
        topics: [topic],
      });
    }
  });
  it.each([
    ['نرخ دلار را کجا تعریف کنم؟', 'finance', 'exchange-rates'],
    ['شعبه بانک را کجا تعریف کنم؟', 'finance', 'bank-branches'],
    ['چرا فایل هتل وارد نشد؟', 'accommodation', 'hotels'],
    ['قالب مانیفست کجاست؟', 'transportation', 'manifest-templates'],
    ['طرح بیمه را از کجا تعریف کنم؟', 'insurance', 'insurance-plans'],
    ['انواع تور کجاست؟', 'tours-travel-services', 'tour-types'],
    ['کانال فروش کجاست؟', 'sales-references', 'sales-channels'],
    ['کارگزار کجا تعریف می‌شود؟', 'organizations-suppliers', 'brokers'],
  ])('routes %s', (question, section, id) => {
    expect(resolveMasterDataQuestion(question, '/master-data')).toMatchObject({
      kind: 'guide',
      href: '/master-data/' + section,
      topics: expect.arrayContaining([expect.objectContaining({ id })]),
    });
  });
  it('keeps related workflows distinct and links the specialized hotel-rate page', () => {
    expect(
      resolveMasterDataQuestion(
        'نرخ این قرارداد چطور محاسبه شد؟',
        '/master-data',
      ),
    ).toBeUndefined();
    expect(
      resolveMasterDataQuestion(
        'خرید هتل این قرارداد ثبت شده؟',
        '/master-data',
      ),
    ).toBeUndefined();
    expect(resolveMasterDataQuestion('نرخ پایه هتل کجاست؟', '/')).toMatchObject(
      { href: '/master-data/accommodation/hotel-rates' },
    );
  });
  it('uses an authorized exact match and projects only safe fields', async () => {
    using list = vi.spyOn(masterDataApi, 'list').mockResolvedValue({
      data: [record],
      meta: { page: 1, pageSize: 10, total: 1 },
    });
    expect(await readMasterDataGuide(query, signal, () => false)).toContain(
      'دسترسی',
    );
    expect(list).not.toHaveBeenCalled();
    expect(
      await readMasterDataGuide(
        query,
        signal,
        (resource) => resource === 'airports',
      ),
    ).toBe('فرودگاه نمونه · ABC · غیرفعال');
    expect(list).toHaveBeenCalledWith(
      'airports',
      expect.objectContaining({ status: 'all', search: 'abc' }),
      undefined,
      signal,
    );
    list.mockResolvedValue({
      data: [record],
      meta: { page: 1, pageSize: 10, total: 11 },
    });
    expect(await readMasterDataGuide(query, signal, () => true)).toContain(
      'یکتا',
    );
    list.mockRejectedValue(new MasterDataApiError('private', 401));
    expect(await readMasterDataGuide(query, signal, () => true)).toContain(
      'دوباره وارد شوید',
    );
  });
});

it('does not disclose similarly coded or protected records', async () => {
  const dotted = resolveMasterDataQuestion(
    'وضعیت فرودگاه کد AB.C چیست؟',
    '/master-data/geography',
  );
  if (dotted?.kind !== 'read') throw new Error('Expected a lookup');
  using list = vi.spyOn(masterDataApi, 'list').mockResolvedValue({
    data: [record],
    meta: { page: 1, pageSize: 10, total: 1 },
  });
  expect(await readMasterDataGuide(dotted, signal, () => true)).toContain(
    'پیدا نشد',
  );
  const rate = resolveMasterDataQuestion(
    'نرخ ارز تأیید شد؟',
    '/master-data/finance',
  );
  if (rate?.kind !== 'read') throw new Error('Expected a status question');
  list.mockClear();
  expect(await readMasterDataGuide(rate, signal, () => true)).toContain('پنل');
  expect(list).not.toHaveBeenCalled();
});

it('does not convert cancellation into a displayed failure', async () => {
  const controller = new AbortController();
  controller.abort();
  const cancelled = new DOMException('Cancelled', 'AbortError');
  using list = vi.spyOn(masterDataApi, 'list').mockRejectedValue(cancelled);
  await expect(
    readMasterDataGuide(query, controller.signal, () => true),
  ).rejects.toBe(cancelled);
  expect(list).toHaveBeenCalledWith(
    'airports',
    expect.anything(),
    undefined,
    controller.signal,
  );
});
