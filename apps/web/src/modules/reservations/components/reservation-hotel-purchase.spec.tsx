import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  ReservationIntakeV1,
  TravelWorkflowStateV1,
  VoucherSettingsV1,
} from '@rubi/contracts';
import { SupplierFormPurchaseContext } from './reservation-hotel-purchase';

const request = (workflow?: TravelWorkflowStateV1) =>
  ({
    id: 'request',
    snapshot: { serviceSelections: [] },
    workflow,
  }) as unknown as ReservationIntakeV1 & {
    workflow?: TravelWorkflowStateV1;
  };

it('shows the frozen supplier form as the purchase-price context', () => {
  const settings = {
    text: {
      checkIn: '2026-10-01',
      checkOut: '2026-10-05',
      roomType: 'DBL',
    },
    numbers: {
      singleRooms: 1,
      doubleRooms: 2,
      extraBeds: 1,
      customRooms: 0,
    },
    passengers: [
      { id: 'one', selected: true, roomType: 'DBL', age: 'ADL' },
      { id: 'two', selected: true, roomType: 'DBL', age: 'CHD' },
    ],
  } as unknown as VoucherSettingsV1;
  const html = renderToStaticMarkup(
    <SupplierFormPurchaseContext
      request={request({
        sentSupplierFormSettings: settings,
        sentSupplierFormVersion: 7,
      } as TravelWorkflowStateV1)}
    />,
  );
  expect(html).toContain('آخرین فرم ارسال‌شده به کارگزار');
  expect(html).toContain('2026-10-01');
  expect(html).toContain('DBL:');
  expect(html).toContain('CHD:');
  expect(html).toContain('نسخهٔ ارسال‌شده 7');
});

it('does not present an unsent draft as purchase context', () => {
  const html = renderToStaticMarkup(
    <SupplierFormPurchaseContext
      request={request({
        supplierFormSettings: {} as VoucherSettingsV1,
      } as TravelWorkflowStateV1)}
    />,
  );
  expect(html).toContain(
    'هنوز نسخه‌ای از فرم رزواسیون برای کارگزار ارسال نشده',
  );
  expect(html).not.toContain('مبنای قیمت خرید:');
});
