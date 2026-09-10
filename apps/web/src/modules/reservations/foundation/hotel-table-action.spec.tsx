import { describe, expect, it } from 'vitest';
import { hotelTableAction } from './hotel-table-action';
import type { RequestView } from './model';
const row = {
  id: 'qa',
  contractNumber: 'QA',
  status: 'NEW',
  hotelRequested: false,
  hotelConfirmed: false,
} as RequestView;
describe('hotel table workflow actions', () => {
  it('opens request preparation first and prevents confirmation before sending', () => {
    expect(hotelTableAction(row, false, true)).toMatchObject({
      checked: false,
      disabled: false,
      action: 'رزرواسیون',
    });
    expect(hotelTableAction(row, true, true).disabled).toBe(true);
  });
  it('opens atomic supplier confirmation and voucher issuance after sending', () => {
    const sent = {
      ...row,
      status: 'WAITING_SUPPLIER' as const,
      hotelRequested: true,
    };
    expect(hotelTableAction(sent, false, true)).toMatchObject({
      checked: true,
      disabled: true,
    });
    expect(hotelTableAction(sent, true, true)).toMatchObject({
      checked: false,
      disabled: false,
      action: 'Confirmation',
    });
  });
  it('allows legacy supplier confirmations to issue the missing voucher', () => {
    expect(
      hotelTableAction(
        { ...row, status: 'SUPPLIER_CONFIRMED', hotelRequested: true },
        true,
        true,
      ),
    ).toMatchObject({ checked: false, disabled: false, action: 'واچر' });
  });
  it('prevents duplicate issuance, cancellation edits and unauthorized actions', () => {
    expect(
      hotelTableAction(
        {
          ...row,
          hotelRequested: true,
          hotelConfirmed: true,
          status: 'VOUCHER_ISSUED',
        },
        true,
        true,
      ),
    ).toMatchObject({ checked: true, disabled: true });
    expect(
      hotelTableAction({ ...row, status: 'CANCELLED' }, false, true).disabled,
    ).toBe(true);
    expect(hotelTableAction(row, false, false).disabled).toBe(true);
  });
});
