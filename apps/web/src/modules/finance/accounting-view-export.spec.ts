import { afterEach, describe, expect, it, vi } from 'vitest';
import { accountingViewRows } from './accounting-view-export';
class Field {
  id = '';
  type = 'text';
  constructor(
    public value: string,
    private label: string,
    private sensitive = false,
  ) {}
  closest(selector: string) {
    return this.sensitive && selector.includes('data-accounting-sensitive')
      ? {}
      : null;
  }
  getAttribute(name: string) {
    return name === 'aria-label' ? this.label : null;
  }
}
class InputField extends Field {}
class TextAreaField extends Field {
  override type = 'textarea';
}
class SelectField extends Field {}
afterEach(() => vi.unstubAllGlobals());
describe('accounting export secret exclusions', () => {
  it('never collects a sensitive PEM textarea while retaining public fields', () => {
    vi.stubGlobal('HTMLInputElement', InputField);
    vi.stubGlobal('HTMLTextAreaElement', TextAreaField);
    vi.stubGlobal('HTMLSelectElement', SelectField);
    const fields = [
      new InputField('Synthetic public title', 'عنوان'),
      new TextAreaField('SYNTHETIC PRIVATE KEY MATERIAL', 'کلید خصوصی', true),
    ];
    const root = {
      querySelectorAll: (selector: string) =>
        selector === 'input,textarea,select' ? fields : [],
    };
    expect(accountingViewRows(root as unknown as HTMLElement)).toEqual([
      ['عنوان', 'Synthetic public title'],
    ]);
  });
});
