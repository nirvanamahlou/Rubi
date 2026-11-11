import { afterEach, describe, expect, it, vi } from 'vitest';
import { readContractFormHelp } from './contract-form-help';
afterEach(() => vi.unstubAllGlobals());
describe('live draft guidance', () => {
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
  it('leaves an unrelated chat request alone', () => {
    vi.stubGlobal('document', { querySelector: () => null });
    expect(readContractFormHelp('خلاصه امروز')).toBeUndefined();
  });
});
