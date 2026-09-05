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
  withFirstPassengerCustomer,
} from '../model/sales-form';

const draft: SalesPersonDraft = {
  firstName: 'Test',
  lastName: 'Person',
  birthDate: '1995-01-01',
  nationalId: '0000000019',
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
  it('creates requested roles and requires national ID for customers too', () => {
    expect(salesPersonInput(draft, 'customer').roles).toEqual(['customer']);
    expect(salesPersonInput(draft, 'passenger').roles).toEqual(['passenger']);
    expect(
      salesPersonInput({ ...draft, alsoPassenger: true }, 'customer').roles,
    ).toEqual(['customer', 'passenger']);
    expect(() =>
      salesPersonInput({ ...draft, nationalId: '' }, 'customer'),
    ).toThrow('۱۰ رقم');
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
  it.each(['', '123456789', '12345678901', '12345x7890'])(
    'rejects missing or non-ten-digit passenger national ID %s before API',
    async (nationalId) => {
      const api = { create: vi.fn() };
      await expect(
        createSalesPerson({ ...draft, nationalId }, 'passenger', api),
      ).rejects.toThrow('۱۰ رقم');
      expect(api.create).not.toHaveBeenCalled();
    },
  );
  it('normalizes Persian and Arabic national ID digits while retaining leading zeros', () => {
    expect(
      salesPersonInput({ ...draft, nationalId: '۰۰۰۰۰۰۰۰۱۹' }, 'passenger')
        .nationalId,
    ).toBe('0000000019');
    expect(
      salesPersonInput({ ...draft, nationalId: '٠٠٠٠٠٠٠٠١٩' }, 'passenger')
        .nationalId,
    ).toBe('0000000019');
  });
  it('follows the first passenger when enabled, including after removal', () => {
    const first = {
      customerId: 'first',
      displayName: 'First',
      birthDate: draft.birthDate,
    };
    const second = {
      customerId: 'second',
      displayName: 'Second',
      birthDate: draft.birthDate,
    };
    const base = {
      ...emptySalesForm,
      firstPassengerIsCustomer: true,
      passengers: [first, second],
    };
    expect(withFirstPassengerCustomer(base).customerId).toBe('first');
    expect(
      withFirstPassengerCustomer({ ...base, passengers: [second] }).customerId,
    ).toBe('second');
    expect(
      withFirstPassengerCustomer({ ...base, passengers: [] }).customerId,
    ).toBe('');
    expect(
      withFirstPassengerCustomer({
        ...base,
        firstPassengerIsCustomer: false,
        customerId: 'separate',
      }).customerId,
    ).toBe('separate');
  });
  it('supports repeated additions and removals without duplicating a person or storing national IDs in Sales', () => {
    let state = emptySalesForm;
    for (let index = 0; index < 30; index++) {
      state = {
        ...state,
        ...selectSalesPerson(
          state,
          {
            id: `person-${index}`,
            displayName: 'Synthetic',
            roles: ['passenger'],
          },
          false,
          draft.birthDate,
        ),
      };
    }
    expect(state.passengers).toHaveLength(30);
    expect(JSON.stringify(state)).not.toContain('nationalId');
    const reduced = { ...state, passengers: state.passengers.slice(0, 10) };
    expect(
      selectSalesPerson(
        reduced,
        { id: 'person-0', displayName: 'Synthetic', roles: ['passenger'] },
        false,
      ).passengers,
    ).toHaveLength(10);
  });
  it('renders numbered passenger rows with mandatory national ID and a removable draft', () => {
    const html = renderToStaticMarkup(
      <SalesPersonCreate
        mode="passenger"
        title="مسافر ۲"
        saveDisabled
        onCreated={vi.fn()}
        onCancel={vi.fn()}
        onBusyChange={vi.fn()}
      />,
    );
    expect(html).toContain('مسافر ۲');
    expect(html).toContain('کد ملی ۱۰رقمی');
    expect(html).toContain('maxLength="10"');
    expect(html).not.toContain('کد ملی (اختیاری)');
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
