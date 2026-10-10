import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { saveTicketFormOnCtrlS } from './ticket-form';

describe('ticket form usability', () => {
  it('submits the active form with Ctrl+S', () => {
    const preventDefault = vi.fn();
    const requestSubmit = vi.fn();

    saveTicketFormOnCtrlS({
      ctrlKey: true,
      altKey: false,
      shiftKey: false,
      key: 's',
      preventDefault,
      currentTarget: { requestSubmit },
    } as never);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(requestSubmit).toHaveBeenCalledOnce();
  });

  it('keeps all weekdays visible and renders a columnar sorted date preview', () => {
    const load = readFileSync(
      new URL('./flight-load-grid.tsx', import.meta.url),
      'utf8',
    );
    const schedule = readFileSync(
      new URL('./flight-schedule-form.tsx', import.meta.url),
      'utf8',
    );

    expect(load).toContain('scheduleWeekdays.length + 1');
    expect(schedule).toContain('chronologicalScheduleDates(preview)');
    expect(schedule).toContain('<th>تاریخ رفت</th>');
    expect(schedule).toContain('<th>تاریخ برگشت</th>');
    expect(schedule).toContain('onKeyDown={saveTicketFormOnCtrlS}');
  });

  it('prevents application dialogs from closing on outside interaction', () => {
    const overlays = readFileSync(
      new URL('../../../components/ui/overlays.tsx', import.meta.url),
      'utf8',
    );
    expect(overlays).toContain('onPointerDownOutside={(event) =>');
    expect(overlays).toContain('onInteractOutside={(event) =>');
    expect(overlays.match(/event\.preventDefault\(\)/g)).toHaveLength(2);
  });
});
