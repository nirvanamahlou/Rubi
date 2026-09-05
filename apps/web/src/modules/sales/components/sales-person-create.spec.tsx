import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  createSalesPerson,
  salesPersonInput,
  SalesPersonCreate,
  type SalesPersonDraft,
} from './sales-person-create';
import {
  emptySalesForm,
  salesSteps,
  selectSalesPerson,
} from '../model/sales-form';

const draft: SalesPersonDraft = {
  firstName: 'Test',
  lastName: 'Person',
  birthDate: '1995-01-01',
  nationalId: '',
  alsoPassenger: false,
};

describe('combined sales people step', () => {
  it('has one people step followed immediately by payment and review', () => {
    expect(salesSteps).toEqual([
      'مسیر و خدمات',
      'جزئیات سفر',
      'مشتری و مسافران',
      'قیمت و پرداخت',
      'بازبینی',
    ]);
  });
  it('keeps existing passengers and birth dates when selecting a different customer', () => {
    const state = {
      ...emptySalesForm,
      passengers: [
        {
          customerId: 'existing',
          displayName: 'Existing',
          birthDate: '2000-01-01',
        },
      ],
    };
    const next = selectSalesPerson(
      state,
      { id: 'new', displayName: 'New', roles: ['customer', 'passenger'] },
      true,
      draft.birthDate,
    );
    expect(next.customerId).toBe('new');
    expect(next.passengers).toEqual([
      ...state.passengers,
      { customerId: 'new', displayName: 'New', birthDate: draft.birthDate },
    ]);
    expect(
      selectSalesPerson(
        { ...state, ...next },
        { id: 'existing', displayName: 'Existing', roles: ['passenger'] },
        false,
      ).passengers,
    ).toEqual(next.passengers);
  });
  it('does not invent passenger roles for customer-only people', () => {
    expect(
      selectSalesPerson(
        emptySalesForm,
        { id: 'customer', displayName: 'Customer', roles: ['customer'] },
        true,
      ).passengers,
    ).toEqual([]);
  });
  it('creates the requested roles with optional national ID omitted', () => {
    expect(salesPersonInput(draft, 'customer').roles).toEqual(['customer']);
    expect(salesPersonInput(draft, 'passenger').roles).toEqual(['passenger']);
    expect(
      salesPersonInput({ ...draft, alsoPassenger: true }, 'customer').roles,
    ).toEqual(['customer', 'passenger']);
    expect(salesPersonInput(draft, 'customer')).not.toHaveProperty(
      'nationalId',
    );
  });
  it('requires a passenger birthdate and names before calling the API', async () => {
    const api = { create: vi.fn() };
    await expect(
      createSalesPerson({ ...draft, birthDate: '' }, 'passenger', api),
    ).rejects.toThrow('تاریخ تولد');
    await expect(
      createSalesPerson({ ...draft, firstName: ' ' }, 'customer', api),
    ).rejects.toThrow('نام');
    expect(api.create).not.toHaveBeenCalled();
  });
  it('uses the public API result and retains the entered birthdate when the response masks it', async () => {
    const person = {
      id: 'public-id',
      displayName: 'Test Person',
      birthDate: null,
      birthDateMasked: true,
    };
    const api = { create: vi.fn().mockResolvedValue({ data: person }) };
    await expect(createSalesPerson(draft, 'passenger', api)).resolves.toEqual({
      person,
      birthDate: draft.birthDate,
    });
    expect(api.create).toHaveBeenCalledExactlyOnceWith(
      salesPersonInput(draft, 'passenger'),
    );
  });
  it('propagates permission failures without creating a local fake person', async () => {
    const api = { create: vi.fn().mockRejectedValue(new Error('Forbidden')) };
    await expect(createSalesPerson(draft, 'customer', api)).rejects.toThrow(
      'Forbidden',
    );
  });
  it('renders inline controls without nesting another form inside the contract', () => {
    const html = renderToStaticMarkup(
      <SalesPersonCreate
        mode="customer"
        onCreated={vi.fn()}
        onCancel={vi.fn()}
        onBusyChange={vi.fn()}
      />,
    );
    expect(html).toContain('خود مشتری هم مسافر');
    expect(html).toContain('ثبت و افزودن به قرارداد');
    expect(html).not.toContain('<form');
  });
});
