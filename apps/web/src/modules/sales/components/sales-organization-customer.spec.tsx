import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CustomerSummary, MasterDataRecord } from '@rubi/contracts';
import {
  resolveOrganizationCustomer,
  SalesOrganizationCustomer,
} from './sales-organization-customer';
import {
  emptySalesForm,
  salesPayload,
  selectSalesPerson,
  withFirstPassengerCustomer,
} from '../model/sales-form';

const organization = {
  id: 'organization-id',
  name: 'Synthetic Agency',
  status: 'active',
} as MasterDataRecord;
const customer = {
  id: 'customer-id',
  organizationId: organization.id,
  displayName: organization.name,
  kind: 'organization',
  roles: ['customer'],
  status: 'active',
} as CustomerSummary;
const page = (data: CustomerSummary[], total = data.length) => ({
  data,
  meta: { total },
});

describe('Sales organization customer public connection', () => {
  it('reuses an existing organization customer across paginated results without creating another profile', async () => {
    const api = {
      list: vi
        .fn()
        .mockResolvedValueOnce(
          page([{ ...customer, id: 'other', organizationId: 'other-org' }], 2),
        )
        .mockResolvedValueOnce(page([customer], 2)),
      create: vi.fn(),
    };
    expect(await resolveOrganizationCustomer(organization, api)).toBe(customer);
    expect(api.list).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        kind: 'organization',
        branchId: 'all',
        page: 2,
      }),
    );
    expect(api.create).not.toHaveBeenCalled();
  });
  it('creates only a Customer profile linked to the existing stable organization ID', async () => {
    const api = {
      list: vi.fn().mockResolvedValue(page([])),
      create: vi.fn().mockResolvedValue({ data: customer }),
    };
    expect(await resolveOrganizationCustomer(organization, api)).toBe(customer);
    expect(api.create).toHaveBeenCalledExactlyOnceWith({
      kind: 'organization',
      organizationId: organization.id,
      displayName: organization.name,
      roles: ['customer'],
    });
  });
  it('does not duplicate an inactive customer profile', async () => {
    const api = {
      list: vi
        .fn()
        .mockResolvedValue(page([{ ...customer, status: 'inactive' }])),
      create: vi.fn(),
    };
    await expect(
      resolveOrganizationCustomer(organization, api),
    ).rejects.toThrow('پرونده این سازمان موجود است');
    expect(api.create).not.toHaveBeenCalled();
  });
  it('fails closed on unavailable public data or permission failure', async () => {
    const api = {
      list: vi.fn().mockRejectedValue(new Error('Forbidden')),
      create: vi.fn(),
    };
    await expect(
      resolveOrganizationCustomer(organization, api),
    ).rejects.toThrow('Forbidden');
    expect(api.create).not.toHaveBeenCalled();
    await expect(
      resolveOrganizationCustomer({ ...organization, status: 'inactive' }, api),
    ).rejects.toThrow('سازمان فعال');
  });
  it('preserves passengers and sends the legal customer ID, never the organization ID as customer ID', () => {
    const state = {
      ...emptySalesForm,
      firstPassengerIsCustomer: true,
      passengers: [
        {
          customerId: 'person-id',
          displayName: 'Synthetic Person',
          birthDate: '2000-01-01',
        },
      ],
    };
    const next = withFirstPassengerCustomer({
      ...state,
      ...selectSalesPerson(
        state,
        { ...customer, roles: ['customer', 'passenger'] },
        true,
      ),
    });
    expect(next.customerKind).toBe('organization');
    expect(next.customerOrganizationId).toBe(organization.id);
    expect(next.firstPassengerIsCustomer).toBe(false);
    expect(next.passengers).toEqual(state.passengers);
    expect(salesPayload(next).customerId).toBe(customer.id);
    expect(
      withFirstPassengerCustomer({ ...next, firstPassengerIsCustomer: true })
        .customerId,
    ).toBe(customer.id);
  });
  it('renders a real loading state and explicit registration action, without a nested form', () => {
    const html = renderToStaticMarkup(
      <SalesOrganizationCustomer onSelected={vi.fn()} onBusyChange={vi.fn()} />,
    );
    expect(html).toContain('مشتری حقوقی / آژانس');
    expect(html).toContain('ثبت پرونده مشتری حقوقی و انتخاب');
    expect(html).not.toContain('<form');
  });
});
