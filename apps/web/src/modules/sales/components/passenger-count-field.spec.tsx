import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  PassengerCountField,
  parsePassengerCount,
} from './passenger-count-field';

describe('typed passenger integer count', () => {
  it('accepts zero, cleared input and counts above the old dropdown limit', () => {
    expect(parsePassengerCount('')).toBe(0);
    expect(parsePassengerCount('0')).toBe(0);
    expect(parsePassengerCount('42')).toBe(42);
    expect(parsePassengerCount('0012')).toBe(12);
  });
  it.each(['-1', '1.5', '2e3', 'text', '9007199254740992'])(
    'rejects invalid integer %s',
    (value) => {
      expect(parsePassengerCount(value)).toBeNull();
    },
  );
  it('renders a directly editable integer input, not a dropdown', () => {
    const html = renderToStaticMarkup(
      <PassengerCountField
        label="بزرگسال"
        hint="۱۲ سال و بیشتر"
        value={42}
        onChange={vi.fn()}
      />,
    );
    expect(html).toContain('type="number"');
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('step="1"');
    expect(html).toContain('min="0"');
    expect(html).toContain('value="42"');
    expect(html).toContain('aria-label="تعداد بزرگسال"');
    expect(html).not.toContain('<select');
  });
});
