import { describe, expect, it } from 'vitest';
import {
  renderReservationGuide,
  resolveReservationGuide,
} from './reservation-guide';

describe('reservation guide', () => {
  it.each([
    ['queue', 'چطور درخواست‌ها را فیلتر کنم؟'],
    ['handoff', 'وضعیت پذیرش قرارداد در رزرواسیون رو کجا ببینم؟'],
    ['amendment', 'اصلاحیه فروش رو کجا ببینم؟'],
    ['flight', 'چطور شماره بلیت را پیدا کنم؟'],
    ['hotel', 'واچر اقامت دوم رو کجا چک کنم؟'],
    ['purchase', 'خرید پرواز شناور از کجا پیگیری میشه؟'],
    ['insurance', 'بیمه مستقل رو از کجا پیگیری کنم؟'],
    ['manifest', 'چطور خروجی مانیفست بگیرم؟'],
    ['delivery', 'بلیت صادر شده، چرا مجوز تحویل ندارم؟'],
    ['cancellation', 'ابطال بلیت با لغو قرارداد چه فرقی داره؟'],
    ['queue-export', 'خروجی اکسل درخواست‌ها رو کجا بگیرم؟'],
    ['hotel-mail', 'ایمیل کارگزار رو از کجا چک کنم؟'],
    ['insurance-correction', 'برای اصلاح بیمه‌نامه چیکار کنم؟'],
    ['hotel-rates', 'نرخ هتل رو کجا بررسی کنم؟'],
  ])('routes %s', (id, question) => {
    const result = resolveReservationGuide(question, '/reservations');
    expect(result && 'topic' in result && result.topic.id).toBe(id);
  });

  it('gives the recovery step after navigation', () => {
    const result = resolveReservationGuide(
      'بعدش چی؟',
      '/workbench',
      'manifest',
    );
    if (!result || !('topic' in result))
      throw new Error('Missing manifest topic');
    expect(
      renderReservationGuide(result.topic, result.followUp, result.inspection),
    ).toContain('مسافر جامانده');
  });

  it('defers reports and rankings to their existing handlers', () => {
    expect(
      resolveReservationGuide(
        'چطور خروجی گزارش رزرواسیون بگیرم؟',
        '/reservations',
      ),
    ).toBeUndefined();
    expect(
      resolveReservationGuide('پرفروش‌ترین هتل‌ها کدامند؟', '/reservations'),
    ).toBeUndefined();
  });

  it('acknowledges when the case was not checked', () => {
    const result = resolveReservationGuide(
      'واچر قرارداد ۱۲۳۴۵۶ صادر شده؟',
      '/reservations',
    );
    if (!result || !('topic' in result))
      throw new Error('Missing voucher topic');
    expect(
      renderReservationGuide(result.topic, result.followUp, result.inspection),
    ).toContain('برای تأیید وضعیت این پرونده');
  });
});
