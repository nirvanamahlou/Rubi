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
  linkCustomerAsFirst,
  editPeopleRow,
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
  it('updates an existing customer passport and adds only the passenger role with optimistic version', async () => {
    const one = {
      ...state,
      passengerComposition: { adults: 1, children: 0, infants: 0 },
    };
    const profile = detail('existing', {
      roles: ['customer'],
      version: 5,
      passportExpiryDate: '2030-01-01',
    });
    const draft = initialSalesPeopleDraft(one);
    draft.rows.p0 = selectedPeopleRow(profile);
    draft.rows.p0.values.passportNumber = 'TEST1234';
    draft.rows.p0.values.passportExpiryDate = '2032-01-01';
    const api = {
      create: vi.fn(),
      addContact: vi.fn(),
      update: vi.fn(async (_id: string, input: CustomerMutationRequest) => ({
        data: detail('existing', {
          roles: input.roles,
          version: 6,
              passportExpiryDate: input.passportExpiryDate ?? null,
          maskedPassportNumber: 'T*****34',
        }),
      })),
    };
    const result = await saveSalesPeopleDraft(one, draft, vi.fn(), api);
    expect(api.create).not.toHaveBeenCalled();
    expect(api.update).toHaveBeenCalledWith(
      'existing',
      expect.objectContaining({
        version: 5,
        roles: ['customer', 'passenger'],
        passportNumber: 'TEST1234',
        passportExpiryDate: '2032-01-01',
      }),
    );
    await saveSalesPeopleDraft(one, result.draft, vi.fn(), api);
    expect(api.update).toHaveBeenCalledTimes(1);
  });
  it('keeps a failed linked creation guarded when the customer row is edited', async () => {
    let draft = linkCustomerAsFirst(
      {
        ...filled(),
        mode: 'person',
        rows: { ...filled().rows, primary: filled().rows.p0! },
      },
      true,
    );
    const api = {
      create: vi.fn().mockRejectedValue(new Error('network')),
      addContact: vi.fn(),
    };
    await expect(
      saveSalesPeopleDraft(
        state,
        draft,
        (next) => {
          draft = next;
        },
        api,
      ),
    ).rejects.toThrow('قطعی نشد');
    draft = editPeopleRow(draft, 'primary', {
      ...draft.rows.primary!,
      values: { ...draft.rows.primary!.values, firstName: 'Changed' },
    });
    await expect(
      saveSalesPeopleDraft(state, draft, vi.fn(), api),
    ).rejects.toThrow('نیازمند بررسی');
    expect(api.create).toHaveBeenCalledTimes(1);
  });

  it('copies payer into the first slot, synchronizes edits and restores the displaced passenger', () => {
    const draft = { ...filled(), mode: 'person' as const };
    draft.rows.primary = {
      values: {
        ...emptyPeopleValues(),
        firstName: 'Payer',
        passportNumber: 'TEST1234',
        passportExpiryDate: '2031-01-01',
      },
    };
    const previous = draft.rows.p0;
    let linked = linkCustomerAsFirst(draft, true);
    expect(linked.rows.p0).toEqual(draft.rows.primary);
    expect(passengerSlotKeys(state)).toHaveLength(4);
    linked = editPeopleRow(linked, 'primary', {
      values: { ...linked.rows.primary!.values, lastName: 'Updated' },
    });
    expect(linked.rows.p0?.values.lastName).toBe('Updated');
    const detached = linkCustomerAsFirst(linked, false);
    expect(detached.rows.p0).toEqual(previous);
    expect(detached.rows.primary?.values.passportExpiryDate).toBe('2031-01-01');
  });
  it('passes passport expiry to the existing public customer create API', async () => {
    const draft = filled();
    draft.rows.p0!.values.passportNumber = 'TEST1234';
    draft.rows.p0!.values.passportExpiryDate = '2031-02-03';
    const api = {
      create: vi.fn(async (input: CustomerMutationRequest) => ({
        data: detail(input.nationalId!, { roles: input.roles }),
      })),
      addContact: vi.fn(),
    };
    await saveSalesPeopleDraft(state, draft, vi.fn(), api);
    expect(api.create.mock.calls[0]![0]).toMatchObject({
      passportNumber: 'TEST1234',
      passportExpiryDate: '2031-02-03',
    });
  });
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
