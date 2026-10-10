import { describe, expect, it, vi } from 'vitest';
import type { CustomerDetail, CustomerMutationRequest } from '@nora/contracts';
import {
  emptySalesForm,
  salesPayload,
  type SalesFormState,
} from './sales-form';
import { CustomersApiError } from '@/modules/customers/public/entry';
import {
  emptyPeopleValues,
  initialSalesPeopleDraft,
  normalizeSalesPeopleDraft,
  passengerSlotKeys,
  peopleRow,
  selectedPeopleRow,
  validateSalesPeopleDraft,
  saveSalesPeopleDraft,
  linkCustomerAsFirst,
  editPeopleRow,
  refreshPeopleRow,
  setSalesPeopleAcquaintanceMethod,
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
  it('defaults new contract passenger country fields to IRN while keeping them editable', () => {
    expect(emptyPeopleValues()).toMatchObject({
      nationalityCode: 'IRN',
      passportIssuingCountryCode: 'IRN',
      birthCountryCode: 'IRN',
    });
    expect(
      peopleRow(initialSalesPeopleDraft(state), 'p0').values,
    ).toMatchObject({
      nationalityCode: 'IRN',
      passportIssuingCountryCode: 'IRN',
      birthCountryCode: 'IRN',
    });
  });
  it('never seeds an organization record into an empty passenger slot', () => {
    const agency = initialSalesPeopleDraft({
      ...emptySalesForm,
      customerKind: 'organization',
      customerId: 'agency-person',
      customerName: 'Sample Agency',
      customerOrganizationId: 'agency',
    });
    expect(agency.mode).toBe('organization');
    expect(agency.rows.primary).toBeUndefined();
    expect(
      normalizeSalesPeopleDraft({ ...agency, mode: 'first-passenger' }).rows.p0,
    ).toBeUndefined();
  });
  it('normalizes old separate payers without overwriting passenger one or the archived payer', () => {
    const first = filled().rows.p0!;
    const primary = {
      values: { ...emptyPeopleValues(), firstName: 'Previous payer' },
    };
    const normalized = normalizeSalesPeopleDraft({
      ...filled(),
      mode: 'person',
      rows: { p0: first, primary },
    });
    expect(normalized.mode).toBe('first-passenger');
    expect(normalized.rows.p0).toEqual(first);
    expect(normalized.rows.primary).toEqual(first);
    expect(normalized.previousSeparateCustomer).toEqual(primary);
    expect(normalizeSalesPeopleDraft(normalized)).toEqual(normalized);
    const agency = { ...normalized, mode: 'organization' as const };
    expect(normalizeSalesPeopleDraft(agency)).toBe(agency);
  });
  const one = {
    ...state,
    passengerComposition: { adults: 1, children: 0, infants: 0 },
  };
  const savedPerson = (values = filled().rows.p0!.values) =>
    detail('saved', {
      ...values,
      roles: ['customer', 'passenger'],
      contacts: [],
      nationalId: values.nationalId,
      gender:
        values.gender === 'M' || values.gender === 'F' ? values.gender : null,
      displayName: values.firstName + ' ' + values.lastName,
    });
  it('saves acquaintance selection for new passengers, with first passenger as customer even for a legacy separate draft', async () => {
    const draft = filled();
    draft.mode = 'person';
    draft.rows.p0!.values.acquaintanceMethodId = 'registered-method';
    const create = vi.fn(async (input: CustomerMutationRequest) => ({
      data: {
        ...savedPerson(),
        acquaintanceMethodId: input.acquaintanceMethodId ?? null,
      },
    }));
    const result = await saveSalesPeopleDraft(one, draft, vi.fn(), {
      create,
      addContact: vi.fn(),
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        acquaintanceMethodId: 'registered-method',
        roles: ['customer', 'passenger'],
      }),
    );
    expect(result.patch.customerId).toBe(
      result.patch.passengers[0]?.customerId,
    );
    expect(result.patch.firstPassengerIsCustomer).toBe(true);
  });
  it('applies the one contract-level acquaintance method to every person row', () => {
    const draft = setSalesPeopleAcquaintanceMethod(filled(), 'social-media');
    expect(draft.acquaintanceMethodId).toBe('social-media');
    expect(
      Object.values(draft.rows).every(
        (row) => row.values.acquaintanceMethodId === 'social-media',
      ),
    ).toBe(true);
  });
  it('updates only an explicitly changed acquaintance method through the versioned customer API and preserves it on retry', async () => {
    const profile = {
      ...savedPerson(),
      acquaintanceMethodId: 'old-method',
      version: 7,
    };
    const selected = selectedPeopleRow(profile);
    expect(selected.values.acquaintanceMethodId).toBe('old-method');
    const draft = {
      ...filled(),
      rows: {
        p0: {
          ...selected,
          values: { ...selected.values, acquaintanceMethodId: 'new-method' },
        },
      },
    };
    const update = vi.fn(
      async (_id: string, input: CustomerMutationRequest) => ({
        data: { ...profile, ...input, version: 8 } as CustomerDetail,
      }),
    );
    const api = { create: vi.fn(), addContact: vi.fn(), update };
    const result = await saveSalesPeopleDraft(one, draft, vi.fn(), api);
    expect(update).toHaveBeenCalledWith(
      'saved',
      expect.objectContaining({
        acquaintanceMethodId: 'new-method',
        version: 7,
      }),
    );
    await saveSalesPeopleDraft(one, result.draft, vi.fn(), api);
    expect(update).toHaveBeenCalledTimes(1);
    expect(api.create).not.toHaveBeenCalled();
  });
  it('allows corrected retry after a definitive server rejection', async () => {
    let progress = filled();
    const api = {
      create: vi
        .fn()
        .mockRejectedValueOnce(new CustomersApiError('invalid', 400))
        .mockResolvedValue({ data: savedPerson() }),
      addContact: vi.fn(),
    };
    await expect(
      saveSalesPeopleDraft(
        one,
        progress,
        (next) => {
          progress = next;
        },
        api,
      ),
    ).rejects.toThrow('invalid');
    expect(progress.rows.p0?.reviewRequired).toBe(false);
    await expect(
      saveSalesPeopleDraft(one, progress, vi.fn(), api),
    ).resolves.toMatchObject({ patch: { customerId: 'saved' } });
    expect(api.create).toHaveBeenCalledTimes(2);
  });
  it('recovers a committed creation after lost response without creating twice', async () => {
    let progress = filled();
    const api = {
      create: vi.fn().mockRejectedValue(new Error('network')),
      addContact: vi.fn(),
      detail: vi.fn(),
      registrationLookup: vi.fn().mockResolvedValue({ data: savedPerson() }),
    };
    await expect(
      saveSalesPeopleDraft(
        one,
        progress,
        (next) => {
          progress = next;
        },
        api,
      ),
    ).rejects.toThrow('قطعی نشد');
    const result = await saveSalesPeopleDraft(one, progress, vi.fn(), api);
    expect(result.patch.customerId).toBe('saved');
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.registrationLookup).toHaveBeenCalledWith(
      expect.objectContaining({
        nationalId: progress.rows.p0!.values.nationalId,
      }),
    );
  });
  it('retries the same identity only after an authorized lookup found no previous record', async () => {
    let progress = filled();
    const api = {
      create: vi
        .fn()
        .mockRejectedValueOnce(new Error('network'))
        .mockResolvedValue({ data: savedPerson() }),
      addContact: vi.fn(),
      detail: vi.fn(),
      registrationLookup: vi.fn().mockResolvedValue({ data: null }),
    };
    await expect(
      saveSalesPeopleDraft(
        one,
        progress,
        (next) => {
          progress = next;
        },
        api,
      ),
    ).rejects.toThrow('قطعی نشد');
    await saveSalesPeopleDraft(one, progress, vi.fn(), api);
    expect(api.create).toHaveBeenCalledTimes(2);
    expect(api.create.mock.calls[0]).toEqual(api.create.mock.calls[1]);
  });
  it('does not recreate when recovery is forbidden, including after changing national ID', async () => {
    let progress = filled();
    const api = {
      create: vi.fn().mockRejectedValue(new Error('network')),
      addContact: vi.fn(),
      detail: vi.fn(),
      registrationLookup: vi
        .fn()
        .mockRejectedValue(new CustomersApiError('forbidden', 403)),
    };
    await expect(
      saveSalesPeopleDraft(
        one,
        progress,
        (next) => {
          progress = next;
        },
        api,
      ),
    ).rejects.toThrow('قطعی نشد');
    await expect(
      saveSalesPeopleDraft(one, progress, vi.fn(), api),
    ).rejects.toThrow('forbidden');
    progress.rows.p0!.values.nationalId = national('009000009');
    await expect(
      saveSalesPeopleDraft(one, progress, vi.fn(), api),
    ).rejects.toThrow('forbidden');
    expect(api.create).toHaveBeenCalledTimes(1);
  });
  it.each([true, false])(
    'resolves the current national ID and updates it without mutating the previous record (previous exists: %s)',
    async (previousExists) => {
      const draft = filled();
      const previousId = draft.rows.p0!.values.nationalId;
      const values = {
        ...draft.rows.p0!.values,
        nationalId: '',
        firstName: 'Corrected',
      };
      draft.rows.p0 = {
        values,
        reviewRequired: true,
        pendingNationalId: previousId,
      };
      const existing = {
        ...savedPerson(values),
        id: 'current',
        firstName: 'Old',
        version: 7,
        contacts: [{ type: 'phone', value: '09120000000', isPrimary: true }],
        passportNumber: 'A12345678',
        passportExpiryDate: '2031-01-01',
      } as unknown as CustomerDetail;
      const api = {
        create: vi.fn(),
        addContact: vi.fn(),
        detail: vi.fn(),
        registrationLookup: vi
          .fn()
          .mockResolvedValueOnce({
            data: previousExists ? { ...existing, id: 'previous' } : null,
          })
          .mockResolvedValueOnce({ data: existing }),
        update: vi.fn().mockResolvedValue({
          data: { ...existing, firstName: 'Corrected', version: 8 },
        }),
      };
      let progress = draft;
      const result = await saveSalesPeopleDraft(
        one,
        draft,
        (next) => {
          progress = next;
        },
        api,
      );
      expect(
        api.registrationLookup.mock.calls.map((call) => call[0].nationalId),
      ).toEqual([previousId, values.nationalId]);
      expect(api.update).toHaveBeenCalledExactlyOnceWith(
        'current',
        expect.objectContaining({ firstName: 'Corrected', version: 7 }),
      );
      expect(api.create).not.toHaveBeenCalled();
      expect(api.addContact).not.toHaveBeenCalled();
      expect(result.patch.customerId).toBe('current');
      expect(progress.rows.p0!.values.phone).toBe('09120000000');
      expect(progress.rows.p0!.values.passportNumber).toBe('A12345678');
      expect(Boolean(progress.rows.p0!.previousRegistrationRetained)).toBe(
        previousExists,
      );
    },
  );
  it('creates the corrected identity if absent and retains the earlier registration without editing it', async () => {
    const draft = filled();
    const previousId = draft.rows.p0!.values.nationalId;
    draft.rows.p0 = {
      values: { ...draft.rows.p0!.values, nationalId: national('009000009') },
      reviewRequired: true,
      pendingNationalId: previousId,
    };
    const api = {
      create: vi
        .fn()
        .mockResolvedValue({ data: savedPerson(draft.rows.p0.values) }),
      addContact: vi.fn(),
      detail: vi.fn(),
      update: vi.fn(),
      registrationLookup: vi
        .fn()
        .mockResolvedValueOnce({ data: savedPerson() })
        .mockResolvedValueOnce({ data: null }),
    };
    await saveSalesPeopleDraft(one, draft, vi.fn(), api);
    expect(api.create).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ nationalId: draft.rows.p0.values.nationalId }),
    );
    expect(api.update).not.toHaveBeenCalled();
  });
  it('automatically reuses and updates an existing national ID on the same confirmation', async () => {
    const draft = filled();
    const existing = { ...savedPerson(), firstName: 'Old', version: 4 };
    const api = {
      create: vi
        .fn()
        .mockRejectedValue(
          new CustomersApiError('exists', 409, 'CUSTOMER_NATIONAL_ID_EXISTS'),
        ),
      addContact: vi.fn(),
      registrationLookup: vi.fn().mockResolvedValue({ data: existing }),
      update: vi
        .fn()
        .mockResolvedValue({ data: { ...savedPerson(), version: 5 } }),
    };
    const result = await saveSalesPeopleDraft(one, draft, vi.fn(), api);
    expect(result.patch.customerId).toBe('saved');
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.update).toHaveBeenCalledExactlyOnceWith(
      'saved',
      expect.objectContaining({ firstName: 'Synthetic', version: 4 }),
    );
    expect(api.registrationLookup).toHaveBeenCalledWith(
      expect.objectContaining({ matchByNationalId: true }),
    );
  });
  it('does not loop or recreate when a duplicate is outside accessible scope', async () => {
    const api = {
      create: vi
        .fn()
        .mockRejectedValue(
          new CustomersApiError('exists', 409, 'CUSTOMER_NATIONAL_ID_EXISTS'),
        ),
      addContact: vi.fn(),
      registrationLookup: vi.fn().mockResolvedValue({ data: null }),
    };
    await expect(
      saveSalesPeopleDraft(one, filled(), vi.fn(), api),
    ).rejects.toThrow('exists');
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.registrationLookup).toHaveBeenCalledTimes(1);
  });
  it('continues only the unfinished email after phone succeeds and email is rejected', async () => {
    let progress = filled();
    progress.rows.p0!.values.phone = '09120000000';
    progress.rows.p0!.values.email = 'synthetic@example.test';
    const profile = savedPerson();
    const api = {
      create: vi.fn().mockResolvedValue({ data: profile }),
      addContact: vi
        .fn()
        .mockResolvedValueOnce({ data: { ...profile, version: 2 } })
        .mockRejectedValueOnce(new CustomersApiError('email invalid', 400))
        .mockResolvedValueOnce({ data: { ...profile, version: 3 } }),
    };
    await expect(
      saveSalesPeopleDraft(
        one,
        progress,
        (next) => {
          progress = next;
        },
        api,
      ),
    ).rejects.toThrow('email invalid');
    expect(progress.rows.p0?.savedValues?.phone).toBe('09120000000');
    await saveSalesPeopleDraft(one, progress, vi.fn(), api);
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.addContact.mock.calls.map((c) => c[1].type)).toEqual([
      'phone',
      'email',
      'email',
    ]);
    expect(api.addContact.mock.calls[2]?.[1].version).toBe(2);
  });
  it('refreshes a known person after lost contact response and skips the committed contact', async () => {
    let progress = filled();
    progress.rows.p0!.values.phone = '09120000000';
    const profile = savedPerson();
    const api = {
      create: vi.fn().mockResolvedValue({ data: profile }),
      addContact: vi.fn().mockRejectedValue(new Error('network')),
      detail: vi.fn().mockResolvedValue({
        data: {
          ...profile,
          version: 2,
          contacts: [{ type: 'phone', value: '09120000000', isPrimary: true }],
        },
      }),
    };
    await expect(
      saveSalesPeopleDraft(
        one,
        progress,
        (next) => {
          progress = next;
        },
        api,
      ),
    ).rejects.toThrow('پرونده شخص ایجاد شد');
    await saveSalesPeopleDraft(one, progress, vi.fn(), api);
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.addContact).toHaveBeenCalledTimes(1);
    expect(api.detail).toHaveBeenCalledWith('saved', 'customer-verification');
  });
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
        }),
      ).values,
    ).toMatchObject({ nationalId: '***1234', birthDate: '' });
  });
  it('uses only server-authorized revealed identity and contacts and retains dirty edits on refresh', () => {
    const masked = selectedPeopleRow(detail('existing'));
    masked.values.firstName = 'Edited';
    const revealed = detail('existing', {
      nationalId: national('009000001'),
      contacts: [
        {
          id: 'phone',
          type: 'phone',
          value: '00000000000',
          maskedValue: '***0000',
          isPrimary: true,
          label: null,
          verifiedAt: null,
          createdAt: '2026-01-01',
        },
      ],
    });
    const refreshed = refreshPeopleRow(masked, revealed);
    expect(refreshed.values.firstName).toBe('Edited');
    expect(refreshed.values.nationalId).toBe(revealed.nationalId);
    expect(refreshed.values.phone).toBe('00000000000');
    expect(refreshed.savedValues?.firstName).toBe('Synthetic');
  });
  it('updates selected identity once with version, omits untouched masks and preserves other roles', async () => {
    const one = {
      ...state,
      passengerComposition: { adults: 1, children: 0, infants: 0 },
    };
    const profile = detail('existing', {
      roles: ['customer', 'passenger'],
      version: 7,
      contacts: [],
    });
    const draft = initialSalesPeopleDraft(one);
    draft.rows.p0 = selectedPeopleRow(profile);
    draft.rows.p0.values.firstName = 'Edited';
    draft.rows.p0.values.phone = '00000000000';
    const api = {
      create: vi.fn(),
      update: vi.fn(async (_id: string, input: CustomerMutationRequest) => ({
        data: {
          ...profile,
          firstName: input.firstName,
          displayName: input.displayName,
          version: 8,
        } as CustomerDetail,
      })),
      addContact: vi.fn().mockResolvedValue({
        data: {
          ...profile,
          firstName: 'Edited',
          displayName: 'Edited Person',
          version: 9,
        },
      }),
    };
    const result = await saveSalesPeopleDraft(one, draft, vi.fn(), api);
    const input = api.update.mock.calls[0]![1];
    expect(input).toMatchObject({
      firstName: 'Edited',
      displayName: 'Edited Person',
      version: 7,
      roles: ['customer', 'passenger'],
    });
    expect(input).not.toHaveProperty('nationalId');
    expect(input).not.toHaveProperty('passportNumber');
    expect(api.addContact).toHaveBeenCalledWith(
      'existing',
      expect.objectContaining({ version: 8, value: '00000000000' }),
    );
    expect(result.patch.customerName).toBe('Edited Person');
    expect(result.patch.passengers[0]?.displayName).toBe('Edited Person');
    await saveSalesPeopleDraft(one, result.draft, vi.fn(), api);
    expect(api.update).toHaveBeenCalledTimes(1);
    expect(api.addContact).toHaveBeenCalledTimes(1);
    expect(api.create).not.toHaveBeenCalled();
  });
  it('blocks an invalid replacement ID before writing and propagates a version conflict', async () => {
    const one = {
      ...state,
      passengerComposition: { adults: 1, children: 0, infants: 0 },
    };
    const draft = initialSalesPeopleDraft(one);
    draft.rows.p0 = selectedPeopleRow(
      detail('existing', { roles: ['customer', 'passenger'] }),
    );
    const api = {
      create: vi.fn(),
      addContact: vi.fn(),
      update: vi.fn().mockRejectedValue(new Error('VERSION_CONFLICT')),
    };
    draft.rows.p0.values.nationalId = '123';
    await expect(
      saveSalesPeopleDraft(one, draft, vi.fn(), api),
    ).rejects.toThrow('۱۰رقمی');
    expect(api.update).not.toHaveBeenCalled();
    draft.rows.p0.values.nationalId = draft.rows.p0.savedValues!.nationalId;
    draft.rows.p0.values.firstName = 'Changed';
    await expect(
      saveSalesPeopleDraft(one, draft, vi.fn(), api),
    ).rejects.toThrow('VERSION_CONFLICT');
    expect(api.addContact).not.toHaveBeenCalled();
    expect(draft.rows.p0.values.firstName).toBe('Changed');
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
  it('requires airline identity for every passenger on an international contract', () => {
    const international = {
      ...state,
      serviceKinds: ['FLIGHT'] as SalesFormState['serviceKinds'],
      originCountryId: 'origin-country',
      destinationCountryId: 'destination-country',
    };
    const draft = filled();
    expect(() => validateSalesPeopleDraft(international, draft)).toThrow(
      'نام و نام خانوادگی لاتین پاسپورت الزامی است',
    );
    for (const row of Object.values(draft.rows))
      row.values = {
        ...row.values,
        passportFirstName: 'SYNTHETIC',
        passportLastName: 'PASSENGER',
        gender: 'M',
        nationalityCode: 'IRN',
        passportIssuingCountryCode: 'IRN',
        birthCountryCode: 'IRN',
        passportNumber: 'X1234567',
        passportExpiryDate: '2030-01-01',
      };
    expect(() => validateSalesPeopleDraft(international, draft)).not.toThrow();
  });
  it('treats a route as domestic only when both country codes are Iran', () => {
    const domestic = {
      ...state,
      serviceKinds: ['FLIGHT'] as SalesFormState['serviceKinds'],
      originCountryId: 'iran-a',
      destinationCountryId: 'iran-b',
      originCountryCode: 'IR',
      destinationCountryCode: 'IR',
    };
    expect(() => validateSalesPeopleDraft(domestic, filled())).not.toThrow();
    const foreign = {
      ...domestic,
      originCountryCode: 'TR',
      destinationCountryCode: 'TR',
    };
    expect(() => validateSalesPeopleDraft(foreign, filled())).toThrow(
      'نام و نام خانوادگی لاتین پاسپورت الزامی است',
    );
  });
});

describe('contract buyer independent from passengers', () => {
  it('keeps a separate buyer as customer and payer on international travel without requiring a buyer passport', async () => {
    const travel = {
      ...state,
      originCountryCode: 'IR',
      destinationCountryCode: 'TR',
      originCountryId: 'iran',
      destinationCountryId: 'turkey',
      serviceKinds: ['FLIGHT' as const],
      passengerComposition: { adults: 1, children: 0, infants: 0 },
    };
    const passenger = filled().rows.p0!;
    passenger.values = {
      ...passenger.values,
      passportFirstName: 'SYNTHETIC',
      passportLastName: 'PASSENGER',
      passportNumber: 'A1234567',
      passportExpiryDate: '2029-01-01',
      gender: 'M',
    };
    const buyerContact = {
      name: 'Synthetic Buyer',
      phone: '09120000000',
      address: 'Synthetic address',
      postalCode: '0012345678',
    };
    const draft: SalesPeopleDraft = {
      ...initialSalesPeopleDraft(travel),
      mode: 'person',
      separateCustomer: true,
      buyerContact,
      rows: {
        p0: passenger,
        primary: {
          values: {
            ...emptyPeopleValues(),
            firstName: 'Synthetic',
            lastName: 'Buyer',
            nationalId: '',
          },
        },
      },
    };
    let index = 0;
    const create = vi.fn(async (input: CustomerMutationRequest) => ({
      data: detail('created-' + index++, {
        ...input,
        kind: 'person',
        contacts: [],
        addresses: [],
      } as Partial<CustomerDetail>),
    }));
    const result = await saveSalesPeopleDraft(travel, draft, vi.fn(), {
      create,
      addContact: vi.fn(),
    });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0]![0]).toMatchObject({
      roles: ['customer'],
      firstName: 'Synthetic',
      lastName: 'Buyer',
    });
    expect(create.mock.calls[0]![0].passportNumber).toBeUndefined();
    expect(create.mock.calls[0]![0].nationalId).toBeUndefined();
    expect(create.mock.calls[1]![0]).toMatchObject({
      roles: ['passenger'],
      passportNumber: 'A1234567',
    });
    expect(result.patch).toMatchObject({
      customerId: 'created-0',
      firstPassengerIsCustomer: false,
      buyerContact,
    });
    expect(result.patch.passengers?.[0]?.customerId).toBe('created-1');
    const payload = salesPayload({ ...travel, ...result.patch });
    expect(payload).toMatchObject({
      customerId: 'created-0',
      payerCustomerId: 'created-0',
      buyerContact,
    });
  });
  it('rejects incomplete buyer contact information before creating any customer', async () => {
    const draft = {
      ...filled(),
      buyerContact: {
        name: 'Synthetic Buyer',
        phone: '123',
        address: 'Synthetic address',
        postalCode: '123',
      },
    };
    const create = vi.fn();
    await expect(
      saveSalesPeopleDraft(state, draft, vi.fn(), {
        create,
        addContact: vi.fn(),
      }),
    ).rejects.toThrow('کد پستی');
    expect(create).not.toHaveBeenCalled();
  });
});

describe('customer-only purchase identity safety', () => {
  it('requires passenger identity when promoting a customer-only record into a passenger slot', () => {
    const one = {
      ...state,
      passengerComposition: { adults: 1, children: 0, infants: 0 },
    };
    const person = detail('buyer-only', {
      roles: ['customer'],
      maskedNationalId: null,
      nationalId: null,
    });
    const draft = {
      ...initialSalesPeopleDraft(one),
      rows: { p0: selectedPeopleRow(person) },
    };
    expect(() => validateSalesPeopleDraft(one, draft)).toThrow('کد ملی');
  });
  it('does not retry an uncertain customer-only creation without a safe identity match', async () => {
    const one = {
      ...state,
      passengerComposition: { adults: 1, children: 0, infants: 0 },
    };
    const draft: SalesPeopleDraft = {
      ...filled(),
      mode: 'person',
      separateCustomer: true,
      buyerContact: {
        name: 'Synthetic Buyer',
        phone: '09120000000',
        address: 'Synthetic address',
        postalCode: '0012345678',
      },
      rows: {
        p0: filled().rows.p0!,
        primary: {
          values: {
            ...emptyPeopleValues(),
            firstName: 'Synthetic',
            lastName: 'Buyer',
          },
          reviewRequired: true,
        },
      },
    };
    const create = vi.fn();
    const registrationLookup = vi.fn();
    await expect(
      saveSalesPeopleDraft(one, draft, vi.fn(), {
        create,
        registrationLookup,
        addContact: vi.fn(),
      }),
    ).rejects.toThrow('پرونده موجود');
    expect(create).not.toHaveBeenCalled();
    expect(registrationLookup).not.toHaveBeenCalled();
  });
});
it('recovers a corrected international passenger using passport names when hidden local names are empty', async () => {
  const travel = {
    ...state,
    originCountryCode: 'IR',
    destinationCountryCode: 'TR',
    serviceKinds: ['FLIGHT' as const],
    passengerComposition: { adults: 1, children: 0, infants: 0 },
  };
  const row = filled().rows.p0!;
  row.values = {
    ...row.values,
    firstName: '',
    lastName: '',
    passportFirstName: 'SYNTHETIC',
    passportLastName: 'PASSENGER',
    passportNumber: 'X1234567',
    passportExpiryDate: '2030-01-01',
    gender: 'M',
  };
  row.reviewRequired = true;
  const draft = { ...initialSalesPeopleDraft(travel), rows: { p0: row } };
  const registrationLookup = vi.fn(
    async (input: { firstName: string; lastName: string }) => {
      if (!input.firstName || !input.lastName)
        throw new CustomersApiError(
          'Request validation failed.',
          400,
          'VALIDATION_ERROR',
        );
      return { data: null };
    },
  );
  const create = vi.fn(async (input: CustomerMutationRequest) => ({
    data: detail('created-passenger', {
      ...input,
      contacts: [],
      addresses: [],
    } as Partial<CustomerDetail>),
  }));
  const result = await saveSalesPeopleDraft(travel, draft, vi.fn(), {
    registrationLookup,
    create,
    addContact: vi.fn(),
  });
  expect(registrationLookup).toHaveBeenCalledWith(
    expect.objectContaining({
      firstName: 'SYNTHETIC',
      lastName: 'PASSENGER',
      matchByNationalId: true,
    }),
  );
  expect(create).toHaveBeenCalledTimes(1);
  expect(result.patch.customerId).toBe('created-passenger');
  expect(result.draft.rows.p0?.reviewRequired).toBeFalsy();
});
