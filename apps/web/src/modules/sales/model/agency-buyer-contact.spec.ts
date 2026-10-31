import { beforeEach, expect, it, vi } from 'vitest';
import { agencyBuyerContact } from './agency-buyer-contact';
import { salesApi } from '../api/client';
vi.mock('../api/client', () => ({
  salesApi: { agencyBuyerContact: vi.fn() },
}));
const buyer = {
  name: 'Synthetic agency',
  phone: '',
  address: '',
  postalCode: '',
  landline: '',
};
beforeEach(() => vi.resetAllMocks());
it('fills selected agency details through the contract creator projection', async () => {
  vi.mocked(salesApi.agencyBuyerContact).mockResolvedValue({
    data: {
      ...buyer,
      phone: '09121234567',
      landline: '02112345678',
      address: 'Synthetic address',
      postalCode: '1234567890',
    },
  });
  expect(await agencyBuyerContact('agency', buyer)).toEqual({
    ...buyer,
    phone: '09121234567',
    landline: '02112345678',
    address: 'Synthetic address',
    postalCode: '1234567890',
  });
  expect(salesApi.agencyBuyerContact).toHaveBeenCalledWith('agency');
});
it('preserves the customer fallback when the agency has no recorded contact values', async () => {
  vi.mocked(salesApi.agencyBuyerContact).mockResolvedValue({ data: buyer });
  const fallback = {
    ...buyer,
    phone: '09121234567',
    address: 'Manual address',
  };
  expect(await agencyBuyerContact('agency', fallback)).toEqual(fallback);
});
it('does not hide access or server errors as empty contact information', async () => {
  vi.mocked(salesApi.agencyBuyerContact).mockRejectedValue(
    new Error('unavailable'),
  );
  await expect(agencyBuyerContact('agency', buyer)).rejects.toThrow(
    'unavailable',
  );
});
