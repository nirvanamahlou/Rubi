import { describe, expect, it, vi } from 'vitest';
import type { CustomerDetail, CustomerMutationRequest } from '@rubi/contracts';
import { emptySalesForm, type SalesFormState } from './sales-form';
import {
  emptyPeopleValues,
  initialSalesPeopleDraft,
  passengerSlotKeys,
  peopleRow,
  selectedPeopleRow,
  validateSalesPeopleDraft,
  saveSalesPeopleDraft,
  type SalesPeopleDraft,
} from './sales-people-sheet';
const state: SalesFormState = {
  ...emptySalesForm,
  serviceKinds: ['OTHER'],
  departureDate: '2026-10-01',
  passengerComposition: { adults: 2, children: 1, infants: 1 },
  firstPassengerIsCustomer: true,
};
const national = (prefix: string) => {
  const sum =
    [...prefix].reduce(
      (total, digit, index) => total + Number(digit) * (10 - index),
      0,
    ) % 11;
  return prefix + String(sum < 2 ? sum : 11 - sum);
};
const filled = (): SalesPeopleDraft => ({
  ...initialSalesPeopleDraft(state),
  rows: Object.fromEntries(
    ['1990-01-01', '1980-01-01', '2020-01-01', '2026-01-01'].map(
      (birthDate, index) => [
        'p' + index,
        {
          values: {
            ...emptyPeopleValues(),
            firstName: 'Synthetic',
            lastName: 'Person' + index,
            nationalId: national('00900000' + index),
            birthDate,
          },
        },
      ],
    ),
  ),
});
const detail = (id: string, input: Partial<CustomerDetail> = {}) =>
  ({
    id,
    displayName: 'Synthetic Person',
    firstName: 'Synthetic',
    lastName: 'Person',
    birthDate: '1990-01-01',
    birthDateMasked: false,
    version: 1,
    maskedNationalId: '***1234',
    maskedPassportNumber: null,
    maskedPrimaryContact: null,
    ...input,
  }) as CustomerDetail;
describe('fixed Sales people-entry slots', () => {
  it('opens exactly the selected count and adds only one slot when an infant is added', () => {
    expect(passengerSlotKeys(state)).toEqual(['p0', 'p1', 'p2', 'p3']);
    expect(
      passengerSlotKeys({
        ...state,
        passengerComposition: { ...state.passengerComposition, infants: 2 },
      }),
    ).toEqual(['p0', 'p1', 'p2', 'p3', 'p4']);
    expect(
      peopleRow(initialSalesPeopleDraft(state), 'p3').values.firstName,
    ).toBe('');
  });
  it('keeps restored IDs and dates without fabricating split names or sensitive identity data', () => {
    const restored = initialSalesPeopleDraft({
      ...state,
      passengers: [
        {
          customerId: 'saved',
          displayName: 'Existing Name',
          birthDate: '1980-01-01',
        },
      ],
    });
    expect(restored.rows.p0?.person?.id).toBe('saved');
    expect(restored.rows.p0?.values.birthDate).toBe('1980-01-01');
    expect(restored.rows.p0?.values.nationalId).toBe('');
    expect(
      selectedPeopleRow(
        detail('masked', {
          birthDateMasked: true,
          nationalId: 'sensitive-raw',
        }),
      ).values,
    ).toMatchObject({ nationalId: '***1234', birthDate: '' });
  });
  it('validates every row, age composition and duplicate IDs before creating anything', async () => {
    const draft = filled();
    expect(() => validateSalesPeopleDraft(state, draft)).not.toThrow();
    draft.rows.p3!.values.birthDate = '1990-01-01';
    const api = { create: vi.fn(), addContact: vi.fn() };
    await expect(
      saveSalesPeopleDraft(state, draft, vi.fn(), api),
    ).rejects.toThrow('مرحله اول');
    expect(api.create).not.toHaveBeenCalled();
    draft.rows.p3!.values.birthDate = '2026-01-01';
    draft.rows.p3!.values.nationalId = draft.rows.p0!.values.nationalId;
    expect(() => validateSalesPeopleDraft(state, draft)).toThrow('تکراری');
  });
  it('creates the first passenger once as customer and confirms all slots together', async () => {
    const api = {
      create: vi.fn(async (input: CustomerMutationRequest) => ({
        data: detail('person-' + input.nationalId, {
          displayName: input.displayName,
        }),
      })),
      addContact: vi.fn(),
    };
    const result = await saveSalesPeopleDraft(state, filled(), vi.fn(), api);
    expect(api.create).toHaveBeenCalledTimes(4);
    expect(api.create.mock.calls[0]![0].roles).toEqual([
      'customer',
      'passenger',
    ]);
    expect(result.patch.passengers).toHaveLength(4);
    expect(result.patch.customerId).toBe(
      result.patch.passengers[0]!.customerId,
    );
    expect(result.patch.hotel.guestCustomerIds).toHaveLength(4);
  });
  it('preserves an organization payer independently from passengers', async () => {
    const draft = {
      ...filled(),
      mode: 'organization' as const,
      organization: {
        id: 'agency-customer',
        displayName: 'Synthetic Agency',
        organizationId: 'organization',
      },
    };
    const api = {
      create: vi.fn(async (input: CustomerMutationRequest) => ({
        data: detail(input.nationalId!),
      })),
      addContact: vi.fn(),
    };
    const result = await saveSalesPeopleDraft(state, draft, vi.fn(), api);
    expect(result.patch.customerId).toBe('agency-customer');
    expect(result.patch.firstPassengerIsCustomer).toBe(false);
    expect(
      api.create.mock.calls.every(
        ([input]) => input.roles.join() === 'passenger',
      ),
    ).toBe(true);
  });
  it('retains successful IDs and blocks blind retry after an uncertain create', async () => {
    let progress = filled();
    const api = {
      create: vi
        .fn()
        .mockResolvedValueOnce({ data: detail('saved-first') })
        .mockRejectedValueOnce(new Error('network')),
      addContact: vi.fn(),
    };
    await expect(
      saveSalesPeopleDraft(
        state,
        progress,
        (next) => {
          progress = next;
        },
        api,
      ),
    ).rejects.toThrow('قطعی نشد');
    expect(progress.rows.p0?.person?.id).toBe('saved-first');
    expect(progress.rows.p1?.reviewRequired).toBe(true);
    await expect(
      saveSalesPeopleDraft(state, progress, vi.fn(), api),
    ).rejects.toThrow('نیازمند بررسی');
    expect(api.create).toHaveBeenCalledTimes(2);
  });
  it('keeps the created identity when contact persistence fails', async () => {
    let progress = filled();
    progress.rows.p0!.values.phone = '09120000000';
    const api = {
      create: vi.fn().mockResolvedValue({ data: detail('saved-first') }),
      addContact: vi.fn().mockRejectedValue(new Error('network')),
    };
    await expect(
      saveSalesPeopleDraft(
        state,
        progress,
        (next) => {
          progress = next;
        },
        api,
      ),
    ).rejects.toThrow('پرونده شخص ایجاد شد');
    expect(progress.rows.p0).toMatchObject({
      person: { id: 'saved-first' },
      reviewRequired: true,
    });
    expect(api.create).toHaveBeenCalledTimes(1);
  });
});
