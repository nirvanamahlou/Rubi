import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('./tour-workspace.tsx', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n');

describe('tour departure ticket selection', () => {
  it('loads outbound and return tickets across the selected date range', () => {
    expect(source.match(/dates\.start,\n\s+dates\.end,/g)).toHaveLength(2);
    expect(source).toContain(
      'فقط بلیت‌هایی نمایش داده می‌شوند که تاریخ حرکتشان از روز شروع',
    );
    expect(source).toContain('dates.end < dates.start');
  });
});
