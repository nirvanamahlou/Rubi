import { describe, expect, it, vi } from 'vitest';
import { agencyClient } from '../organizations/api/agency-client';
import {
  b2bGuideTopics,
  readB2bGuide,
  renderB2bGuide,
  resolveB2bQuestion,
} from './b2b-guide';

const context = {
  search: 'نمونه',
  status: 'active',
  role: 'AGENCY',
  selected: '',
  branch: '',
} as const;
const organization = {
  id: '1',
  resource: 'organizations',
  code: 'ABC',
  name: 'نمونه',
  status: 'active',
  attributes: { roleCodes: 'AGENCY,CORPORATE_CUSTOMER', nationalId: 'private' },
  version: 1,
  createdAt: '',
  updatedAt: '',
} as const;

describe('B2B assistant guidance', () => {
  it.each(b2bGuideTopics)(
    'routes catalogue example for $id and renders local guidance',
    (topic) => {
      const result = resolveB2bQuestion(topic.example, true);
      expect(result).toMatchObject({ kind: 'guide', topic: { id: topic.id } });
      const answer = renderB2bGuide(topic);
      expect(topic.href).toBe('/organizations');
      expect(answer).toContain(topic.next);
      expect(answer).toContain('پیش‌نیاز');
    },
  );
  it.each([
    ['چرا عدد فهرست B2B فرق دارد', 'metrics'],
    ['فرم ثبت آژانس کجاست', 'registration'],
    ['حذف دائمی مخاطب چطوریه', 'delete'],
    ['شماره تماس آژانس را کجا ببینم', 'profile'],
    ['نرخ آژانس کجاست', 'agreement'],
    ['اعتبار موقت کی تمام می شود', 'credit'],
    ['گزارش فعالیت کجاست', 'activity'],
    ['مدرک امضادار را کجا بارگذاری کنم', 'documents'],
    ['ورود از Excel کجاست', 'excel'],
  ])('routes %s and remembers a topic', (q, id) => {
    expect(resolveB2bQuestion(q, true)).toMatchObject({
      kind: 'guide',
      topic: { id },
    });
    expect(resolveB2bQuestion('بعدش چی؟', false, id)).toMatchObject({
      kind: 'guide',
      topic: { id },
    });
  });
  it('preserves adjacent guides', () => {
    expect(
      resolveB2bQuestion('وضعیت قرارداد مشتری سازمانی چیست', true),
    ).toBeUndefined();
    expect(resolveB2bQuestion('مدارک مشتری B2C کجاست', true)).toBeUndefined();
  });
  it('merges duplicate roles for an exact status lookup without exposing identity fields', async () => {
    using list = vi.spyOn(agencyClient, 'list').mockResolvedValue({
      data: [organization],
      meta: { page: 1, pageSize: 10, total: 1 },
    });
    const lookup = resolveB2bQuestion('وضعیت آژانس همکار کد ABC چیست؟', true);
    if (lookup?.kind !== 'status') throw new Error('Expected status lookup');
    const result = await readB2bGuide(lookup, context, () => true);
    expect(result).toContain('نمونه · ABC');
    expect(result).not.toContain('private');
    expect(list).toHaveBeenCalledTimes(2);
    list.mockResolvedValue({
      data: [organization],
      meta: { page: 1, pageSize: 10, total: 11 },
    });
    expect(await readB2bGuide(lookup, context, () => true)).toContain('یکتا');
  });
  it('reports filtered metrics using both roles and a deduplicated identity count', async () => {
    using list = vi.spyOn(agencyClient, 'list').mockResolvedValue({
      data: [organization],
      meta: { page: 1, pageSize: 100, total: 1 },
    });
    const result = await readB2bGuide(
      { kind: 'metrics', external: false },
      context,
      () => true,
    );
    expect(result).toContain('نیازمند تکمیل هویت ۱');
    expect(result).toContain('نتایج فیلتر فعلی ۱');
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'نمونه',
        status: 'active',
        role: 'AGENCY',
      }),
    );
  });
});
