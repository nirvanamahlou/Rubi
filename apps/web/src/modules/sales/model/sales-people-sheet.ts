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
  profile?: CustomerDetail;
  savedPassportNumber?: string;
}
export interface SalesPeopleDraft {
  mode: 'person' | 'first-passenger' | 'organization';
  rows: Record<string, PeopleRow>;
  displacedFirst?: PeopleRow;
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
  passportExpiryDate: '',
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
  if (state.firstPassengerIsCustomer && rows.p0) rows.primary = rows.p0;
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
    profile: person,
    savedPassportNumber:
      person.passportNumber ?? person.maskedPassportNumber ?? '',
    values: {
      ...emptyPeopleValues(),
      firstName: person.firstName ?? person.displayName,
      lastName: person.lastName ?? '',
      birthDate: person.birthDateMasked
        ? ''
        : (person.birthDate?.slice(0, 10) ?? ''),
      nationalId: person.maskedNationalId ?? '',
      passportNumber:
        person.passportNumber ?? person.maskedPassportNumber ?? '',
      passportExpiryDate: person.passportExpiryDate ?? '',
      phone: person.maskedPrimaryContact ?? '',
    },
  };
}
export function linkCustomerAsFirst(
  draft: SalesPeopleDraft,
  linked: boolean,
): SalesPeopleDraft {
  if (linked) {
    if (draft.mode === 'organization')
      throw new Error('مشتری حقوقی نمی‌تواند مسافر باشد.');
    if (draft.mode === 'first-passenger') return draft;
    return {
      ...draft,
      mode: 'first-passenger',
      displacedFirst: peopleRow(draft, 'p0'),
      rows: { ...draft.rows, p0: peopleRow(draft, 'primary') },
    };
  }
  return {
    ...draft,
    mode: 'person',
    rows: {
      ...draft.rows,
      primary: peopleRow(draft, 'p0'),
      p0: draft.displacedFirst ?? { values: emptyPeopleValues() },
    },
  };
}
export function editPeopleRow(
  draft: SalesPeopleDraft,
  key: string,
  row: PeopleRow,
): SalesPeopleDraft {
  const rows = { ...draft.rows, [key]: row };
  if (draft.mode === 'first-passenger' && (key === 'primary' || key === 'p0')) {
    rows.primary = row;
    rows.p0 = row;
  }
  return { ...draft, rows };
}
function validatePassport(row: PeopleRow) {
  const expiry = row.values.passportExpiryDate;
  if (
    expiry &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(expiry) ||
      Number.isNaN(Date.parse(expiry)) ||
      new Date(expiry).toISOString().slice(0, 10) !== expiry)
  )
    throw new Error('تاریخ انقضای پاسپورت معتبر نیست.');
  const number = row.values.passportNumber.trim();
  if (row.person && row.savedPassportNumber && !number)
    throw new Error(
      'برای تغییر پاسپورت، شماره جدید را وارد کنید؛ حذف مدرک از این فرم انجام نمی‌شود.',
    );
  if (
    number &&
    number !== row.profile?.maskedPassportNumber &&
    !/^[A-Z0-9-]{4,24}$/i.test(number)
  )
    throw new Error('شماره پاسپورت معتبر نیست.');
}
export function peopleCreateInput(
  row: PeopleRow,
  customer: boolean,
  passenger: boolean,
): CustomerMutationRequest {
  validatePassport(row);
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
    ...(v.passportExpiryDate
      ? { passportExpiryDate: v.passportExpiryDate }
      : {}),
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
    validatePassport(row);
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
  api: Pick<typeof customersApi, 'create' | 'addContact'> &
    Partial<Pick<typeof customersApi, 'update' | 'detail'>> = customersApi,
) {
  validateSalesPeopleDraft(state, draft);
  let current = { ...draft, rows: { ...draft.rows } };
  const keys = passengerSlotKeys(state);
  for (const key of [
    ...(draft.mode === 'person' ? ['primary'] : []),
    ...keys,
  ]) {
    const row = peopleRow(current, key);
    if (row.person) {
      const customerRole =
        key === 'primary' || (draft.mode === 'first-passenger' && key === 'p0');
      const profile = row.profile;
      const passportChanged =
        profile &&
        (row.values.passportExpiryDate !== (profile.passportExpiryDate ?? '') ||
          row.values.passportNumber !==
            (row.savedPassportNumber ??
              profile.passportNumber ??
              profile.maskedPassportNumber ??
              ''));
      const needsRole =
        profile &&
        ((customerRole && !profile.roles.includes('customer')) ||
          (key !== 'primary' && !profile.roles.includes('passenger')));
      if (passportChanged || needsRole) {
        if (!api.update) throw new Error('اتصال ویرایش مشتری در دسترس نیست.');
        const roles = [
          ...new Set([
            ...profile.roles,
            ...(customerRole ? ['customer' as const] : []),
            ...(key !== 'primary' ? ['passenger' as const] : []),
          ]),
        ];
        const number = row.values.passportNumber.trim();
        const updated = (
          await api.update(row.person.id, {
            kind: 'person',
            displayName: profile.displayName,
            firstName: profile.firstName,
            lastName: profile.lastName,
            acquaintanceMethodId: profile.acquaintanceMethodId,
            roles,
            version: profile.version,
            ...(row.values.birthDate
              ? { birthDate: row.values.birthDate }
              : {}),
            ...(passportChanged
              ? { passportExpiryDate: row.values.passportExpiryDate || null }
              : {}),
            ...(number &&
            number !== profile.maskedPassportNumber &&
            number !== profile.passportNumber
              ? { passportNumber: number }
              : {}),
          })
        ).data;
        current = editPeopleRow(current, key, {
          ...row,
          profile: updated,
          savedPassportNumber: row.values.passportNumber,
        });
        onProgress(current);
      }
      continue;
    }
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
      current = editPeopleRow(current, key, { ...row, reviewRequired: true });
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
          profile: created,
          savedPassportNumber: row.values.passportNumber,
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
        created = (
          await api.addContact(created.id, {
            type: 'email',
            value: row.values.email.trim().toLowerCase(),
            label: 'اصلی',
            isPrimary: !row.values.phone.trim(),
            version: created.version,
          })
        ).data;
      current = editPeopleRow(current, key, {
        ...current.rows[key]!,
        profile: created,
      });
      onProgress(current);
    } catch (error) {
      current = editPeopleRow(current, key, {
        ...current.rows[key]!,
        reviewRequired: true,
      });
      onProgress(current);
      throw new Error(
        'پرونده شخص ایجاد شد ولی ثبت تماس کامل نشد؛ تماس را در مشتریان بررسی و سپس همین پرونده را انتخاب کنید. ' +
          (error instanceof Error ? error.message : ''),
      );
    }
  }
  if (draft.mode === 'first-passenger')
    current = editPeopleRow(current, 'p0', peopleRow(current, 'p0'));
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
