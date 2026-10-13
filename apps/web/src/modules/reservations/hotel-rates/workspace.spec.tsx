import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HotelRateStayRange } from './workspace';

it('uses the shared project calendar for both hotel stay dates', () => {
  const html = renderToStaticMarkup(
    <HotelRateStayRange
      checkIn="2026-09-12"
      checkOut="2026-09-18"
      onCheckIn={vi.fn()}
      onCheckOut={vi.fn()}
    />,
  );

  expect(html).toContain('ورود به هتل');
  expect(html).toContain('خروج از هتل');
  expect(html.match(/aria-haspopup="dialog"/g)).toHaveLength(2);
  expect(html).toContain('name="checkIn"');
  expect(html).toContain('name="checkOut"');
  expect(html).not.toContain('type="date"');
});
