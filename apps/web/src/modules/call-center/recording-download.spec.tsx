import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DisplayLocaleContext } from '@/i18n/locale-context';
import { RecordingDownload } from './recording-download';
describe('localized recording download action', () => {
  it.each(['fa', 'en'] as const)(
    'places icon after text in logical %s order',
    (language) => {
      const html = renderToStaticMarkup(
        <DisplayLocaleContext.Provider value={language}>
          <RecordingDownload callId="call" branchId="branch" allowed />
        </DisplayLocaleContext.Provider>,
      );
      expect(html).toContain(`dir="${language === 'fa' ? 'rtl' : 'ltr'}"`);
      expect(html).toContain(
        language === 'fa' ? 'دانلود فایل صوتی' : 'Download audio file',
      );
      expect(html.indexOf('</span>')).toBeLessThan(html.indexOf('<svg'));
      expect(html).toContain('aria-hidden="true"');
    },
  );
  it('explains unavailable permission without exposing a file URL', () => {
    const html = renderToStaticMarkup(
      <RecordingDownload callId="call" branchId="branch" allowed={false} />,
    );
    expect(html).toContain('disabled=""');
    expect(html).toContain('مجوز');
    expect(html).not.toContain('href=');
  });
});
