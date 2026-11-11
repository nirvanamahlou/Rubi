import { describe, expect, it } from 'vitest';
import { contractGuideAnswer } from './contract-guides';

describe('contract guidance intent', () => {
  it('explains ticket-only creation without asking for a contract number', () => {
    expect(
      contractGuideAnswer('چطور قرارداد فقط بلیت ببندم؟', false),
    ).toContain('هر دو پرواز');
  });
  it('does not invent guidance for a factual payment question', () => {
    expect(
      contractGuideAnswer('پرداخت قرارداد چقدر است؟', true),
    ).toBeUndefined();
  });
  it('does not capture a hotel question outside sales', () => {
    expect(contractGuideAnswer('چطور هتل انتخاب کنم؟', false)).toBeUndefined();
  });
  it('provides payment instructions in the open sales form', () => {
    expect(contractGuideAnswer('رسید رو از کجا ثبت کنم؟', true)).toContain(
      'قیمت و پرداخت',
    );
  });
});
