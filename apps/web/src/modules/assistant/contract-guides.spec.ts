import { describe, expect, it } from 'vitest';
import { contractGuideAnswer, resolveContractGuide } from './contract-guides';

describe('ERP contract workflow help', () => {
  it.each([
    'چجور قرارداد بزنم؟',
    'چجوری قرارداد بزنم',
    'چطوری قرارداد ببندم؟',
    'چطور یک قرارداد جدید بسازم؟',
    'ميخوام قرار داد ببندم',
    'می‌خوام قرارداد ثبت کنم',
    'راهنمای کامل ثبت قرارداد',
    'مراحل قرارداد زدن',
    'برای قرارداد باید چه کار کنم؟',
  ])('teaches the full ERP workflow for %s', (question) => {
    const reply = resolveContractGuide(question, false);
    expect(reply?.topicId).toBe('create');
    expect(reply?.text).toContain(
      'فروش و ارتباط با مشتری → قرارداد → قرارداد جدید',
    );
    for (const action of [
      'مشتری و طرف حساب قرارداد',
      'ثبت و تأیید افراد',
      'تخصیص خدمات مسافران',
      'تأیید مسیر و خدمات',
      'قیمت و پرداخت',
      'بازبینی',
      'ثبت و ارسال به رزرواسیون',
    ]) {
      expect(reply?.text).toContain(action);
    }
    expect(reply?.text).not.toContain('مشاور حقوقی');
  });

  it.each([
    ['چطور قرارداد رو پیدا کنم؟', 'list'],
    ['طرف حساب چیه؟', 'buyer'],
    ['چطور مشتری حقوقی انتخاب کنم؟', 'agency'],
    ['کشور مقصد رو کجا انتخاب کنم؟', 'route'],
    ['چطور قرارداد فقط بلیت ببندم؟', 'flight'],
    ['اطلاعات مسافر رو چطور وارد کنم؟', 'passengers'],
    ['نام انگلیسی مطابق پاسپورت رو چطور بزنم؟', 'passport'],
    ['چطور تخصیص خدمات رو انجام بدم؟', 'allocation'],
    ['اتاق هتل رو چطور انتخاب کنم؟', 'hotel'],
    ['چطور دو هتل اضافه کنم؟', 'multi-hotel'],
    ['چجوری بیمه رو انتخاب کنم؟', 'insurance'],
    ['ترانسفر رو چطور انتخاب کنم؟', 'transfer'],
    ['ویزا رو چطور ثبت کنم؟', 'visa'],
    ['پکیج تور رو چطور انتخاب کنم؟', 'package'],
    ['قیمت مسافر رو چطور وارد کنم؟', 'price'],
    ['مبلغ قرارداد ثبت شده را چطور اصلاح کنم؟', 'correction'],
    ['چرا کمیسیون از مبلغ کل کم نشده؟', 'commission'],
    ['چجوری قرارداد چکی بزنم؟', 'cheque'],
    ['پرداخت نقدی رو چطور اضافه کنم؟', 'payment'],
    ['رسید رو از کجا بارگذاری کنم؟', 'receipt'],
    ['Notice قرارداد چیه؟', 'notes'],
    ['ثبت نهایی رو چطور انجام بدم؟', 'review'],
    ['دکمه مرحله بعد غیرفعاله چیکار کنم؟', 'blocked'],
    ['چطور اطلاعات ثبت شده رو ویرایش کنم؟', 'correction'],
    ['چطور قرارداد قدیمی رو کامل کنم؟', 'legacy'],
    ['PDF رو چطور بگیرم؟', 'output'],
    ['چرا واچر هنوز صادر نشده؟', 'documents'],
    ['رزرواسیون رو از کجا پیگیری کنم؟', 'reservation'],
    ['خرید قرارداد شناوری از کجاست؟', 'purchase'],
    ['پیش‌نویس رو چطور ادامه بدم؟', 'draft'],
  ])('routes %s to grounded instructions', (question, topicId) => {
    const reply = resolveContractGuide(question, true);
    expect(reply?.topicId).toBe(topicId);
    expect(reply?.text).toContain('فروش و ارتباط با مشتری → قرارداد');
    expect(reply?.text).toContain('1. ');
    expect(reply?.text).toContain('2. ');
  });

  it('keeps generic guide wording out of the tour-guide topic', () => {
    expect(resolveContractGuide('راهنمای ثبت قرارداد', true)?.topicId).toBe(
      'create',
    );
  });
  it('explains the actual commission behavior', () => {
    expect(contractGuideAnswer('کمیسیون چرا از کل کم نمیشه؟', true)).toContain(
      'از مبلغ کل قرارداد کسر نمی‌شود',
    );
  });
  it('uses the last guide for a contextual follow-up', () => {
    expect(
      resolveContractGuide('بیشتر توضیح بده', true, 'multi-hotel')?.topicId,
    ).toBe('multi-hotel');
  });
  it.each([
    ['ثبت و تأیید افراد رو زدم بعدش چی؟', 'allocation'],
    ['تأیید مسیر و خدمات رو زدم حالا چیکار کنم؟', 'price'],
    ['قیمت رو وارد کردم بعدش چی؟', 'review'],
    ['قرارداد ثبت شد حالا چیکار کنم؟', 'reservation'],
  ])('advances the workflow after %s', (question, topic) => {
    expect(resolveContractGuide(question, true)?.topicId).toBe(topic);
  });
  it('clarifies an unsupported contract topic locally', () => {
    const reply = resolveContractGuide('شرایط فسخ قرارداد چیه؟', true);
    expect(reply?.text).toContain('درباره کدام بخش');
  });
  it('asks for a record before claiming actual money', () => {
    expect(
      resolveContractGuide('پرداخت قرارداد چقدر است؟', true)?.topicId,
    ).toBe('record');
  });
  it.each([
    'قرارداد 120548 را بررسی کن',
    'قرارداد ۱۲۰۵۴۸ را بررسی کن',
    'قرارداد ١٢٠٥٤٨ را بررسی کن',
  ])('leaves record reading to the authorized tool for %s', (question) => {
    expect(resolveContractGuide(question, true)).toBeUndefined();
  });
  it('can explain corrections after the record tool has read the contract', () => {
    expect(
      contractGuideAnswer('قرارداد ۱۲۰۵۴۸ را چطور اصلاح کنم؟', true, true),
    ).toContain('ثبت اصلاح و اطلاع به رزرواسیون');
  });
  it.each([
    'سلام',
    'درآمد دو روز گذشته چقدر بوده؟',
    'خلاصه امروز',
    'چطور مرخصی بگیرم؟',
  ])('preserves ordinary chat and other ERP requests for %s', (question) => {
    expect(resolveContractGuide(question, true, 'create')).toBeUndefined();
  });
  it('does not claim a hotel question on an unrelated page', () => {
    expect(contractGuideAnswer('چطور هتل انتخاب کنم؟', false)).toBeUndefined();
  });
});
