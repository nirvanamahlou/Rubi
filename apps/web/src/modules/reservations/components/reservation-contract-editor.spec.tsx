import { renderToStaticMarkup } from 'react-dom/server';
import { it, expect } from 'vitest';
import { ReservationContractEditor } from './reservation-contract-editor';
it('keeps one cancellation section and removes duplicate contract/form sections', () => {
  const html = renderToStaticMarkup(
    <ReservationContractEditor requestId="synthetic" contractNumber="TEST" />,
  );
  expect(html).toContain('ویرایش مسافران');
  expect(html).toContain('مبالغ فروش');
  expect(html).toContain('ابطال قرارداد');
  expect(html).not.toContain('تأیید و لغو ابطال');
  expect(html).not.toContain('فرم رزواسیون');
  expect(html).not.toContain('>سایر<');
});
