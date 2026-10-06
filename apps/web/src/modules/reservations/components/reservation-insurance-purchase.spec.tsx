import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import type { ReservationIntakeV1 } from '@nora/contracts';
import { ReservationInsurancePurchase } from './reservation-insurance-purchase';
it('offers insurance cost entry only when the contract selected insurance', () => {
  const request = {
    snapshot: {
      serviceSelections: [
        { clientKey: 'insurance', kind: 'INSURANCE', titleSnapshot: 'Policy' },
      ],
    },
  } as unknown as ReservationIntakeV1;
  const html = renderToStaticMarkup(
    <ReservationInsurancePurchase request={request} onSaved={vi.fn()} />,
  );
  expect(html).toContain('هزینه کل خرید بیمه');
  expect(html).toContain('ثبت خرید بیمه');
  expect(
    renderToStaticMarkup(
      <ReservationInsurancePurchase
        request={{
          ...request,
          snapshot: { ...request.snapshot, serviceSelections: [] },
        }}
        onSaved={vi.fn()}
      />,
    ),
  ).toBe('');
});
