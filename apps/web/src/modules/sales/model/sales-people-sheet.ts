import type { CustomerDetail, CustomerMutationRequest } from '@rubi/contracts';
import {
  customersApi,
  isValidIranianNationalId,
  normalizeNationalId,
  type EntryField,
} from '@/modules/customers/public/entry';
import {
  salesPassengerCompositionMatches,
  salesPassengerCounts,
  salesTravelDate,
  type SalesFormState,
} from './sales-form';

export type PeopleValues = Record<EntryField, string>;
export interface PeopleRow {
  values: PeopleValues;
  person?: { id: string; displayName: string };
  reviewRequired?: boolean;
}
export interface SalesPeopleDraft {
  mode: 'person' | 'first-passenger' | 'organization';
  rows: Record<string, PeopleRow>;
  organization: {
    id: string;
    displayName: string;
    organizationId: string | null;
  } | null;
}
export const emptyPeopleValues = (): PeopleValues => ({
  firstName: '',
  lastName: '',
  nationalId: '',
  birthDate: '',
  passportNumber: '',
  phone: '',
  email: '',
});
export function initialSalesPeopleDraft(
  state: SalesFormState,
): SalesPeopleDraft {
  const rows: Record<string, PeopleRow> = {};
  state.passengers.forEach((person, index) => {
    rows['p' + index] = {
      person: { id: person.customerId, displayName: person.displayName },
      values: {
        ...emptyPeopleValues(),
        firstName: person.displayName,
        birthDate: person.birthDate,
      },
    };
  });
  if (state.customerId)
    rows.primary = {
      person: { id: state.customerId, displayName: state.customerName },
      values: { ...emptyPeopleValues(), firstName: state.customerName },
    };
  return {
    mode:
      state.customerKind === 'organization'
        ? 'organization'
        : state.firstPassengerIsCustomer
          ? 'first-passenger'
          : 'person',
    rows,
    organization:
      state.customerKind === 'organization' && state.customerId
        ? {
            id: state.customerId,
            displayName: state.customerName,
            organizationId: state.customerOrganizationId ?? null,
          }
        : null,
  };
}
export const passengerSlotKeys = (state: SalesFormState) =>
  Array.from(
    { length: salesPassengerCounts(state).total },
    (_, index) => 'p' + index,
  );
export const peopleRow = (draft: SalesPeopleDraft, key: string): PeopleRow =>
  draft.rows[key] ?? { values: emptyPeopleValues() };
export function selectedPeopleRow(person: CustomerDetail): PeopleRow {
  return {
    person: { id: person.id, displayName: person.displayName },
    values: {
      ...emptyPeopleValues(),
      firstName: person.firstName ?? person.displayName,
      lastName: person.lastName ?? '',
      birthDate: person.birthDateMasked
        ? ''
        : (person.birthDate?.slice(0, 10) ?? ''),
      nationalId: person.maskedNationalId ?? '',
      passportNumber: person.maskedPassportNumber ?? '',
      phone: person.maskedPrimaryContact ?? '',
    },
  };
}
export function peopleCreateInput(
  row: PeopleRow,
  customer: boolean,
  passenger: boolean,
): CustomerMutationRequest {
  const v = row.values;
  if (!v.firstName.trim() || !v.lastName.trim())
    throw new Error('نام و نام خانوادگی را کامل کنید.');
  const nationalId = normalizeNationalId(v.nationalId);
  if (!/^\d{10}$/.test(nationalId) || !isValidIranianNationalId(nationalId))
    throw new Error('کد ملی معتبر ۱۰رقمی وارد کنید.');
  if (passenger && !v.birthDate)
    throw new Error('تاریخ تولد مسافر الزامی است.');
  const passportNumber = v.passportNumber
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (passportNumber && !/^[A-Z0-9-]{4,24}$/.test(passportNumber))
    throw new Error('شماره پاسپورت معتبر نیست.');
  if (v.phone.trim() && !/^\+?[0-9]{10,15}$/.test(v.phone.trim()))
    throw new Error('شماره تلفن معتبر وارد کنید.');
  if (v.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim()))
    throw new Error('ایمیل معتبر وارد کنید.');
  return {
    kind: 'person',
    firstName: v.firstName.trim(),
    lastName: v.lastName.trim(),
    displayName: `${v.firstName.trim()} ${v.lastName.trim()}`,
    nationalId,
    roles: customer
      ? passenger
        ? ['customer', 'passenger']
        : ['customer']
      : ['passenger'],
    ...(v.birthDate ? { birthDate: v.birthDate } : {}),
    ...(passportNumber ? { passportNumber } : {}),
  };
}
export function validateSalesPeopleDraft(
  state: SalesFormState,
  draft: SalesPeopleDraft,
) {
  const keys = passengerSlotKeys(state);
  if (!keys.length) throw new Error('تعداد مسافران را در مرحله اول مشخص کنید.');
  if (draft.mode === 'organization' && !draft.organization)
    throw new Error('مشتری حقوقی / آژانس را انتخاب کنید.');
  const ids = new Set<string>(),
    nationalIds = new Set<string>();
  for (const key of [
    ...(draft.mode === 'person' ? ['primary'] : []),
    ...keys,
  ]) {
    const row = peopleRow(draft, key);
    const label =
      key === 'primary' ? 'مشتری اصلی' : `مسافر ${Number(key.slice(1)) + 1}`;
    if (row.reviewRequired)
      throw new Error(
        `${label}: نتیجه ثبت قبلی نیازمند بررسی است؛ پرونده موجود را انتخاب کنید.`,
      );
    if (row.person) {
      if (ids.has(row.person.id))
        throw new Error(
          'یک شخص دوبار انتخاب شده؛ برای مشتری از گزینه «همان مسافر اول» استفاده کنید.',
        );
      ids.add(row.person.id);
    } else {
      try {
        peopleCreateInput(
          row,
          key === 'primary' ||
            (draft.mode === 'first-passenger' && key === 'p0'),
          key !== 'primary',
        );
      } catch (reason) {
        throw new Error(
          label +
            ': ' +
            (reason instanceof Error ? reason.message : 'اطلاعات ناقص است.'),
        );
      }
      const nationalId = normalizeNationalId(row.values.nationalId);
      if (nationalIds.has(nationalId))
        throw new Error(
          'کد ملی تکراری است؛ هر مسافر باید یک ردیف مستقل داشته باشد.',
        );
      nationalIds.add(nationalId);
    }
  }
  const passengers = keys.map((key) => ({
    customerId: key,
    displayName: key,
    birthDate: peopleRow(draft, key).values.birthDate,
  }));
  if (
    !salesTravelDate(state) ||
    !salesPassengerCompositionMatches({ ...state, passengers })
  )
    throw new Error(
      'تاریخ تولد همه مسافران را کامل کنید؛ تعداد بزرگسال، کودک و نوزاد باید با مرحله اول یکسان باشد.',
    );
}
export async function saveSalesPeopleDraft(
  state: SalesFormState,
  draft: SalesPeopleDraft,
  onProgress: (draft: SalesPeopleDraft) => void,
  api: Pick<typeof customersApi, 'create' | 'addContact'> = customersApi,
) {
  validateSalesPeopleDraft(state, draft);
  let current = { ...draft, rows: { ...draft.rows } };
  const keys = passengerSlotKeys(state);
  for (const key of [
    ...(draft.mode === 'person' ? ['primary'] : []),
    ...keys,
  ]) {
    const row = peopleRow(current, key);
    if (row.person) continue;
    let created: CustomerDetail;
    try {
      created = (
        await api.create(
          peopleCreateInput(
            row,
            key === 'primary' ||
              (draft.mode === 'first-passenger' && key === 'p0'),
            key !== 'primary',
          ),
        )
      ).data;
    } catch (error) {
      current = {
        ...current,
        rows: { ...current.rows, [key]: { ...row, reviewRequired: true } },
      };
      onProgress(current);
      throw new Error(
        'ثبت شخص قطعی نشد؛ قبل از تلاش دوباره، همین ردیف را از «انتخاب موجود» بررسی کنید. ' +
          (error instanceof Error ? error.message : ''),
      );
    }
    current = {
      ...current,
      rows: {
        ...current.rows,
        [key]: {
          ...row,
          person: { id: created.id, displayName: created.displayName },
        },
      },
    };
    onProgress(current);
    try {
      if (row.values.phone.trim())
        created = (
          await api.addContact(created.id, {
            type: 'phone',
            value: row.values.phone.trim(),
            label: 'اصلی',
            isPrimary: true,
            version: created.version,
          })
        ).data;
      if (row.values.email.trim())
        await api.addContact(created.id, {
          type: 'email',
          value: row.values.email.trim().toLowerCase(),
          label: 'اصلی',
          isPrimary: !row.values.phone.trim(),
          version: created.version,
        });
    } catch (error) {
      current = {
        ...current,
        rows: {
          ...current.rows,
          [key]: { ...current.rows[key]!, reviewRequired: true },
        },
      };
      onProgress(current);
      throw new Error(
        'پرونده شخص ایجاد شد ولی ثبت تماس کامل نشد؛ تماس را در مشتریان بررسی و سپس همین پرونده را انتخاب کنید. ' +
          (error instanceof Error ? error.message : ''),
      );
    }
  }
  validateSalesPeopleDraft(state, current);
  const passengers = keys.map((key) => {
    const row = peopleRow(current, key);
    return {
      customerId: row.person!.id,
      displayName: row.person!.displayName,
      birthDate: row.values.birthDate,
    };
  });
  const customer =
    draft.mode === 'organization'
      ? draft.organization!
      : peopleRow(current, draft.mode === 'person' ? 'primary' : 'p0').person!;
  return {
    draft: current,
    patch: {
      passengers,
      customerId: customer.id,
      customerName: customer.displayName,
      customerKind:
        draft.mode === 'organization'
          ? ('organization' as const)
          : ('person' as const),
      customerOrganizationId:
        draft.mode === 'organization'
          ? (draft.organization?.organizationId ?? '')
          : '',
      firstPassengerIsCustomer: draft.mode === 'first-passenger',
      hotel: {
        ...state.hotel,
        guestCustomerIds: passengers
          .filter(
            (person) =>
              !state.passengers.some(
                (old) => old.customerId === person.customerId,
              ) ||
              state.hotel.guestCustomerIds === undefined ||
              state.hotel.guestCustomerIds.includes(person.customerId),
          )
          .map((person) => person.customerId),
      },
    },
  };
}
