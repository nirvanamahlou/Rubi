import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AffairsSelect } from './affairs-select';

describe('Rubi Customer Affairs dropdowns', () => {
  it('renders an RTL themed combobox and retains the named form control', () => {
    const html = renderToStaticMarkup(
      <AffairsSelect name="priority" defaultValue="NORMAL" required>
        <option value="LOW">کم</option>
        <option value="NORMAL">عادی</option>
      </AffairsSelect>,
    );
    expect(html).toContain('role="combobox"');
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('name="priority"');
    // Radix registers options after hydration; SSR only exposes the form bridge.
    expect(html).toContain('<select aria-hidden="true"');
    expect(html).toContain('aria-required="true"');
  });
  it('preserves the empty choice and disabled state without an empty Radix item', () => {
    const html = renderToStaticMarkup(
      <AffairsSelect name="owner" value="" disabled>
        <option value="">بدون مسئول</option>
        <option value="one">کارشناس</option>
      </AffairsSelect>,
    );
    expect(html).toContain('بدون مسئول');
    expect(html).toContain('disabled=""');
    expect(html).toContain('name="owner"');
  });
  it('uses the same wrapper for staff, filters and all record forms', () => {
    for (const file of [
      'assignee-picker',
      'record-operations',
      'customer-affairs-workspace',
      'customer-affairs-rubi-workspace',
    ]) {
      const source = readFileSync(
        `src/modules/customer-affairs/components/${file}.tsx`,
        'utf8',
      );
      expect(source).not.toMatch(/<select\b/);
      expect(source).toContain('<AffairsSelect');
    }
  });
});
