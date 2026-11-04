import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CustomerSummary, MasterDataRecord } from '@nora/contracts';
import {
  loadSalesOrganizations,
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
describe('Sales organization customer public connection', () => {
  it('loads every agency page using only the contract reference endpoint', async () => {
    const second = { ...organization, id: 'second-agency' };
    const api = {
      listReferences: vi
        .fn()
        .mockResolvedValueOnce({ data: [organization], meta: { total: 2 } })
        .mockResolvedValueOnce({ data: [second], meta: { total: 2 } }),
    };
    expect(await loadSalesOrganizations(api)).toEqual([organization, second]);
    expect(api.listReferences).toHaveBeenNthCalledWith(
      2,
      'organizations',
      expect.objectContaining({ page: 2, status: 'active', pageSize: 100 }),
    );
  });
  it('resolves the selected agency through the bounded Sales endpoint without customer-directory permissions', async () => {
    const api = {
      resolveAgencyCustomer: vi.fn().mockResolvedValue({ data: customer }),
    };
    expect(await resolveOrganizationCustomer(organization, api)).toBe(customer);
    expect(api.resolveAgencyCustomer).toHaveBeenCalledExactlyOnceWith(
      organization.id,
    );
  });
  it('preserves server conflicts and refuses inactive organization selection', async () => {
    const api = {
      resolveAgencyCustomer: vi
        .fn()
        .mockRejectedValue(new Error('inactive profile')),
    };
    await expect(
      resolveOrganizationCustomer(organization, api),
    ).rejects.toThrow('inactive profile');
    api.resolveAgencyCustomer.mockClear();
    await expect(
      resolveOrganizationCustomer({ ...organization, status: 'inactive' }, api),
    ).rejects.toThrow('سازمان فعال');
    expect(api.resolveAgencyCustomer).not.toHaveBeenCalled();
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
