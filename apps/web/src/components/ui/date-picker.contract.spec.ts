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
  it('uses the blue theme and exposes the calendar switch above the grid', () => {
    expect(pickerSource).toContain("['persian', 'gregorian']");
    expect(pickerSource).toContain("'شمسی'");
    expect(pickerSource).toContain("'میلادی'");
    expect(pickerSource).toContain('bg-primary');
    expect(pickerSource).not.toContain('aria-required');
    expect(pickerSource.indexOf('نوع تقویم')).toBeLessThan(
      pickerSource.indexOf('calendarMonthLabel(anchor'),
    );
  });

  it('prevents raw browser calendars from returning to application forms', () => {
    expect(productionTsx(sourceRoot)).not.toMatch(
      /type=["'](?:date|datetime-local)["']/,
    );
  });
});
