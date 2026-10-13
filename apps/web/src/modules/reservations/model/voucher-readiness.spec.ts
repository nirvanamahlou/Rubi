import { describe, expect, it } from 'vitest';
import {
  hasSentReservationForm,
  voucherActionAvailable,
} from './voucher-readiness';

describe('voucher form readiness', () => {
  it('requires a saved sent form, not only a requested/confirmed flag', () => {
    for (const supplierStatus of [
      'NEW',
      'REQUESTED',
      'CONFIRMED',
      'CANCELLED',
    ] as const)
      expect(
        voucherActionAvailable({ supplierStatus, voucherIssued: false }),
      ).toBe(false);
    expect(
      hasSentReservationForm({
        supplierStatus: 'NEW',
        voucherIssued: false,
        sentSupplierFormSettings: { brokerId: 'broker' },
      }),
    ).toBe(false);
    expect(
      hasSentReservationForm({
        supplierStatus: 'CANCELLED',
        voucherIssued: false,
        sentSupplierFormSettings: { brokerId: 'broker' },
      }),
    ).toBe(false);
    expect(
      hasSentReservationForm({
        supplierStatus: 'REQUESTED',
        voucherIssued: false,
        sentSupplierFormSettings: { brokerId: 'broker' },
      }),
    ).toBe(true);
  });
  it('keeps historical issued vouchers accessible without inventing a sent form', () => {
    expect(
      voucherActionAvailable({
        supplierStatus: 'CONFIRMED',
        voucherIssued: true,
      }),
    ).toBe(true);
  });
});
