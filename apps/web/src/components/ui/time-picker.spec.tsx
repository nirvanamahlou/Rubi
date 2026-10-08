import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { allowedTime, timeSeconds, TimePicker } from './time-picker';
import { Input } from './form-controls';
import { DisplayLocaleContext } from '@/i18n/locale-context';

describe('24-hour themed time selection', () => {
  it('accepts midnight/noon and rejects invalid or 12-hour values', () => {
    expect(timeSeconds('00:00')).toBe(0);
    expect(timeSeconds('12:00')).toBe(43200);
    expect(timeSeconds('23:59:59')).toBe(86399);
    for (const value of ['24:00', '12:60', '23:59:60', '1:30 PM', '9:00', ''])
      expect(timeSeconds(value)).toBeNull();
  });
  it('preserves bounds, overnight ranges and step alignment', () => {
    expect(allowedTime('09:00', '09:00', '17:00', 900)).toBe(true);
    expect(allowedTime('09:05', '09:00', '17:00', 900)).toBe(false);
    expect(allowedTime('18:00', '09:00', '17:00')).toBe(false);
    expect(allowedTime('23:30', '22:00', '02:00')).toBe(true);
    expect(allowedTime('01:00', '22:00', '02:00')).toBe(true);
    expect(allowedTime('12:00', '22:00', '02:00')).toBe(false);
    expect(allowedTime('00:00:30', undefined, undefined, 'any')).toBe(true);
    expect(allowedTime('00:00:30')).toBe(false);
  });
  for (const language of ['fa', 'en'] as const) {
    it(`uses the themed control and canonical submitted value in ${language}`, () => {
      const html = renderToStaticMarkup(
        <DisplayLocaleContext.Provider value={language}>
          <Input
            type="time"
            name="departure"
            value="23:05"
            required
            onChange={() => undefined}
          />
        </DisplayLocaleContext.Provider>,
      );
      expect(html).toContain('type="text"');
      expect(html).not.toContain('type="time"');
      expect(html).toContain('name="departure"');
      expect(html).toContain('value="23:05"');
      expect(html).not.toMatch(/\b(?:AM|PM)\b/);
    });
  }
  it('retains uncontrolled initial data and disabled state', () => {
    const html = renderToStaticMarkup(
      <TimePicker defaultValue="00:15" disabled name="arrival" />,
    );
    expect(html).toContain('value="00:15"');
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
});
