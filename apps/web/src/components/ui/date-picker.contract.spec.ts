import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = join(process.cwd(), 'src');
const pickerSource = readFileSync(
  join(sourceRoot, 'components', 'ui', 'date-picker.tsx'),
  'utf8',
);

function productionTsx(directory: string): string {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return [productionTsx(path)];
      if (!entry.name.endsWith('.tsx') || entry.name.includes('.spec.'))
        return [];
      return [readFileSync(path, 'utf8')];
    })
    .join('\n');
}

describe('shared date picker contract', () => {
  it('uses the blue theme and exposes grid month and year selection', () => {
    expect(pickerSource).toContain("['persian', 'gregorian']");
    expect(pickerSource).toContain("'شمسی'");
    expect(pickerSource).toContain("'میلادی'");
    expect(pickerSource).toContain('شبکه انتخاب ماه');
    expect(pickerSource).toContain('شبکه انتخاب سال');
    expect(pickerSource).toContain(
      "type CalendarView = 'days' | 'months' | 'years'",
    );
    expect(pickerSource).not.toContain('<select');
    expect(pickerSource).toContain(
      "system === 'gregorian' ? 'en-US' : 'fa-IR'",
    );
    expect(pickerSource).toContain('bg-primary');
    expect(pickerSource.indexOf('نوع تقویم')).toBeLessThan(
      pickerSource.indexOf('calendarMonthLabel(anchor'),
    );
  });

  it('positions the popup against the viewport instead of an RTL page edge', () => {
    expect(pickerSource).toContain('resolveCalendarPopoverPosition');
    expect(pickerSource).toContain('getBoundingClientRect()');
    expect(pickerSource).toContain("window.addEventListener('scroll'");
    expect(pickerSource).toContain('className="fixed z-[70]');
    expect(pickerSource).not.toContain(
      'absolute start-0 top-[calc(100%+0.5rem)]',
    );
  });

  it('prevents raw browser calendars from returning to application forms', () => {
    expect(productionTsx(sourceRoot)).not.toMatch(
      /type=["'](?:date|datetime-local)["']/,
    );
  });
});
