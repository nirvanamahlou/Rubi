import { afterEach, describe, expect, it, vi } from 'vitest';
import { readContractFormHelp } from './contract-form-help';
afterEach(() => vi.unstubAllGlobals());
describe('live draft guidance', () => {
  it('distinguishes create success from an unconfirmed reservation handoff', () => {
    vi.stubGlobal('document', {
      querySelector: (key: string) =>
        key === '[data-nora-stage]'
          ? {
              dataset: {
                noraStage: 'final',
                noraSubmitPhase: 'confirming',
                noraError: 'timeout',
                noraCreatedNumber: '123',
              },
            }
          : null,
    });
    expect(readContractFormHelp('خطای ثبت')).toContain('قرارداد 123 ساخته شد');
  });
  it('preserves successful submission when receipt upload failed', () => {
    vi.stubGlobal('document', {
      querySelector: () => ({
        dataset: { noraSaved: '456', noraReceiptError: 'offline' },
      }),
    });
    expect(readContractFormHelp('حالا رسید چی شد؟')).toContain(
      'قرارداد تازه نسازید',
    );
  });
  it('reads the latest form error and never requests a saved contract number', () => {
    const dataset = {
      noraStage: 'مسیر، خدمات و مسافران',
      noraError: 'مسافر دوم را تکمیل کنید',
      noraReady: 'false',
    };
    vi.stubGlobal('document', { querySelector: () => ({ dataset }) });
    expect(readContractFormHelp('چرا جلو نمی‌رود؟')).toContain('مسافر دوم');
    dataset.noraError = '';
    dataset.noraReady = 'true';
    expect(readContractFormHelp('چرا جلو نمی‌رود؟')).toContain('برقرار است');
    expect(readContractFormHelp('چرا جلو نمی‌رود؟')).not.toContain('مسافر دوم');
  });
  it('keeps topical guidance separate from a form blocker', () => {
    vi.stubGlobal('document', {
      querySelector: () => ({
        dataset: {
          noraStage: 'مسیر، خدمات و مسافران',
          noraError: 'مشتری قرارداد را مشخص کنید',
        },
      }),
    });
    expect(readContractFormHelp('چجور قرارداد بزنم؟')).toBeUndefined();
    expect(readContractFormHelp('چرا پروازم تو فهرست نیست؟')).toBeUndefined();
    expect(readContractFormHelp('چرا مرحله بعد فعال نیست؟')).toContain(
      'مشتری و طرف حساب قرارداد',
    );
  });
  it('leaves an unrelated chat request alone', () => {
    vi.stubGlobal('document', { querySelector: () => null });
    expect(readContractFormHelp('خلاصه امروز')).toBeUndefined();
  });
});
