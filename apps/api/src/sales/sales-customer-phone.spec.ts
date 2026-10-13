import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { SalesCustomersPublicAdapter } from './sales.adapters';
import type { CustomerService } from '../customers/customer.service';

describe('Sales legacy customer phone boundary', () => {
  it('uses the audited sensitive-read service for authorized users and prefers primary phone', async () => {
    const detail = vi.fn().mockResolvedValue({
      data: {
        contacts: [
          { type: 'phone', isPrimary: false, value: '08888888888' },
          { type: 'email', isPrimary: true, value: 'synthetic@example.test' },
          { type: 'phone', isPrimary: true, value: '09999999999' },
        ],
      },
    });
    const actor = {
      permissions: ['customers.sensitive.read'],
      branchIds: ['branch'],
    } as AuthenticatedActor;
    const adapter = new SalesCustomersPublicAdapter({
      detail,
    } as unknown as CustomerService);
    expect(await adapter.resolvePhone('customer', actor)).toBe('09999999999');
    expect(detail).toHaveBeenCalledWith(
      'customer',
      actor,
      undefined,
      'customer-verification',
    );
  });
  it('keeps phone masked without sensitive-read permission', async () => {
    const maskedDetail = vi.fn().mockResolvedValue({
      data: {
        contacts: [
          { type: 'phone', isPrimary: true, maskedValue: '099****9999' },
        ],
      },
    });
    const detail = vi.fn();
    const adapter = new SalesCustomersPublicAdapter({
      maskedDetail,
      detail,
    } as unknown as CustomerService);
    expect(
      await adapter.resolvePhone('customer', {
        permissions: [],
      } as unknown as AuthenticatedActor),
    ).toBe('099****9999');
    expect(detail).not.toHaveBeenCalled();
  });
});
