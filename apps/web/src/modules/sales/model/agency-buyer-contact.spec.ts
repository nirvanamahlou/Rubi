import { beforeEach, expect, it, vi } from 'vitest';
import { agencyBuyerContact } from './agency-buyer-contact';
import { agencyClient } from '@/modules/organizations/api/agency-client';
import { masterDataApi } from '@/modules/master-data/api/client';
vi.mock('@/modules/organizations/api/agency-client', () => ({
  agencyClient: { contacts: vi.fn() },
}));
vi.mock('@/modules/master-data/api/client', () => ({
  masterDataApi: {
    organizationAddresses: vi.fn(),
    unmaskOrganizationContact: vi.fn(),
  },
}));
const buyer = {
  name: 'Synthetic agency',
  phone: '',
  address: '',
  postalCode: '',
  landline: '',
};
beforeEach(() => vi.resetAllMocks());
it('fills only selected agency contacts and primary address through authorized APIs', async () => {
  vi.mocked(agencyClient.contacts).mockResolvedValue({
    data: [
      {
        id: 'office',
        status: 'active',
        attributes: { organizationId: 'agency' },
      },
      {
        id: 'mobile',
        status: 'active',
        attributes: { organizationId: 'agency' },
      },
      {
        id: 'foreign',
        status: 'active',
        attributes: { organizationId: 'another' },
      },
    ],
  } as never);
  vi.mocked(masterDataApi.organizationAddresses).mockResolvedValue({
    data: [
      { isPrimary: true, addressLine: 'Synthetic address', postalCode: null },
    ],
  } as never);
  vi.mocked(masterDataApi.unmaskOrganizationContact).mockImplementation(
    async (id) => ({
      data: {
        id,
        phone: id === 'office' ? '02112345678' : '09121234567',
        email: null,
      },
    }),
  );
  expect(await agencyBuyerContact('agency', buyer)).toEqual({
    ...buyer,
    phone: '09121234567',
    landline: '02112345678',
    address: 'Synthetic address',
  });
  expect(masterDataApi.unmaskOrganizationContact).toHaveBeenCalledTimes(2);
  expect(agencyClient.contacts).toHaveBeenCalledWith('agency');
});
it('preserves manual fallback on denied authority and never treats masked contacts as real numbers', async () => {
  vi.mocked(agencyClient.contacts).mockRejectedValue({ status: 403 });
  vi.mocked(masterDataApi.organizationAddresses).mockRejectedValue({
    status: 403,
  });
  expect(await agencyBuyerContact('agency', buyer)).toEqual(buyer);
  expect(masterDataApi.unmaskOrganizationContact).not.toHaveBeenCalled();
});
it('does not hide server errors as empty contact information', async () => {
  vi.mocked(agencyClient.contacts).mockRejectedValue(new Error('unavailable'));
  vi.mocked(masterDataApi.organizationAddresses).mockResolvedValue({
    data: [],
  });
  await expect(agencyBuyerContact('agency', buyer)).rejects.toThrow(
    'unavailable',
  );
});
