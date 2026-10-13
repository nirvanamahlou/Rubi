import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AffairsSelect } from './affairs-select';

describe('Nora Customer Affairs dropdowns', () => {
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
    // The inline search input submits the selected canonical value through the form bridge.
    expect(html).toContain(
      '<input type="hidden" name="priority" value="NORMAL"',
    );
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
      'record-operations',
      'customer-affairs-workspace',
      'customer-affairs-nora-workspace',
    ]) {
      const source = readFileSync(
        `src/modules/customer-affairs/components/${file}.tsx`,
        'utf8',
      );
      expect(source).not.toMatch(/<select\b/);
      expect(source).toContain('<AffairsSelect');
    }
    const assignee = readFileSync(
      'src/modules/customer-affairs/components/assignee-picker.tsx',
      'utf8',
    );
    expect(assignee).not.toMatch(/<select\b/);
    expect(assignee).toContain('<SearchCombobox');
  });
});
