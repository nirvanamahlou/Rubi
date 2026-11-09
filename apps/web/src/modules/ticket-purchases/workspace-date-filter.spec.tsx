import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TicketPurchaseWorkspace } from './workspace';

it('renders accessible flight-day bounds alongside existing search and purchase-status controls', () => {
  const html = renderToStaticMarkup(<TicketPurchaseWorkspace />);
  expect(html).toContain('aria-label="از تاریخ پرواز"');
  expect(html).toContain('aria-label="تا تاریخ پرواز"');
  expect(html).toContain('aria-label="جست‌وجوی پرواز"');
  expect(html).toContain('aria-label="وضعیت خرید"');
  expect(html).not.toContain('role="alert"');
});
