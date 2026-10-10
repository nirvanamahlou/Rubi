import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DurableMessagesPanel } from './marketing-durable-panels';

describe('message form presentation', () => {
  it('renders Persian channel names for message selection', () => {
    const html = renderToStaticMarkup(
      <DurableMessagesPanel scheduled={false} onNotice={() => {}} />,
    );
    for (const label of ['پیامک', 'ایمیل', 'واتساپ', 'اعلان'])
      expect(html).toContain(label);
    for (const code of ['SMS', 'EMAIL', 'WHATSAPP', 'PUSH_NOTIFICATION'])
      expect(html).not.toContain(`>${code}<`);
  });
  it.each([false, true])(
    'places the icon-only save in the final full-width RTL left-aligned row (scheduled=%s)',
    (scheduled) => {
      const html = renderToStaticMarkup(
        <DurableMessagesPanel scheduled={scheduled} onNotice={() => {}} />,
      );
      const label = scheduled ? 'ذخیره ارسال' : 'ذخیره پیام';
      expect(html).toContain(
        'class="flex justify-end md:col-span-2" dir="rtl"><button',
      );
      expect(html).toContain(`aria-label="${label}"`);
      const save = html.slice(
        html.indexOf(`aria-label="${label}"`),
        html.indexOf('</button>', html.indexOf(`aria-label="${label}"`)),
      );
      expect(save).toContain('<svg');
      expect(html.indexOf(`aria-label="${label}"`)).toBeGreaterThan(
        html.indexOf('aria-label="پیام جدید"'),
      );
    },
  );
});
