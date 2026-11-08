import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { ReportPrerequisites } from './report-prerequisites';
describe('report prerequisites in the result area', () => {
  it('shows a blocked reason and required data instead of asking the user to run', () => {
    const html = renderToStaticMarkup(
      <ReportPrerequisites
        readiness={{
          reason: 'دفتر قطعی متصل نیست',
          requirements: ['مانده افتتاحیه', 'گردش قطعی'],
        }}
        error={false}
        onRetry={() => {}}
      />,
    );
    expect(html).toContain('دفتر قطعی متصل نیست');
    expect(html).toContain('مانده افتتاحیه');
    expect(html).toContain('گردش قطعی');
    expect(html).not.toContain('گزارش هنوز اجرا نشده است');
  });
  it('offers retry when the source status cannot be loaded', () => {
    expect(
      renderToStaticMarkup(
        <ReportPrerequisites readiness={null} error onRetry={() => {}} />,
      ),
    ).toContain('تلاش دوباره');
  });
});
