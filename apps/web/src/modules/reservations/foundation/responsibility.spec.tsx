import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReservationResponsibilityView } from './responsibility';
const render = (approved: boolean) =>
  renderToStaticMarkup(
    <ReservationResponsibilityView
      data={{
        delivery: {
          approved,
          updatedAt: '2026-09-29T07:30:00.000Z',
          actorName: 'Financial responsible',
        },
        lastOperation: {
          occurredAt: '2026-09-29T08:30:00.000Z',
          actorName: 'Reservation responsible',
        },
      }}
    />,
  );
describe('selected contract responsibility summary', () => {
  it('shows approval tick and separate responsibility/server timestamps in the requested order', () => {
    const html = render(true);
    expect(html).toContain('checked=""');
    expect(html).toContain('disabled=""');
    expect(html).toContain('Financial responsible');
    expect(html).toContain('Reservation responsible');
    expect(html).toContain('dateTime="2026-09-29T07:30:00.000Z"');
    expect(html).toContain('dateTime="2026-09-29T08:30:00.000Z"');
    expect(html.indexOf('آخرین تغییر رزرواسیون')).toBeLessThan(
      html.indexOf('تحویل مدارک ·'),
    );
  });
  it('retains revocation actor/time without displaying an approval tick', () => {
    const html = render(false);
    expect(html).not.toContain('checked=""');
    expect(html).toContain('تأیید مالی نشده');
    expect(html).toContain('Financial responsible');
  });
  it('does not invent a clock or responsible person when no history exists', () => {
    const html = renderToStaticMarkup(
      <ReservationResponsibilityView
        data={{
          delivery: { approved: false, actorName: null, updatedAt: null },
          lastOperation: null,
        }}
      />,
    );
    expect(html).toContain('عملیاتی ثبت نشده');
    expect(html).toContain('ثبت نشده');
    expect(html).not.toContain('dateTime=');
  });
});
