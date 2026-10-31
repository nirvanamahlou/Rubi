import { expect, it } from 'vitest';
import {
  emptySalesForm,
  salesHotelCapacityError,
  type SalesFormState,
} from './sales-form';
import { salesPassengerStepError } from './sales-passenger-step';

const base = (): SalesFormState => ({
  ...emptySalesForm,
  customerId: 'person',
  customerName: 'Synthetic',
  departureDate: '2099-10-01',
  serviceKinds: ['FLIGHT'],
  passengers: [
    { customerId: 'person', displayName: 'Synthetic', birthDate: '1990-01-01' },
  ],
});
it('allows shared-service passengers without arbitrary manual assignment', () => {
  for (const kind of [
    'FLIGHT',
    'TRANSFER',
    'INSURANCE',
    'BUS',
    'TRAIN',
    'OTHER',
  ] as const)
    expect(
      salesPassengerStepError({ ...base(), serviceKinds: [kind] }, false, null),
    ).toBeNull();
});
it('ignores stale unselected hotel rooms on a flight-only contract', () => {
  const state = {
    ...base(),
    hotel: {
      ...base().hotel,
      rooms: [
        {
          ordinal: 1,
          roomTypeId: 'room',
          roomTypeNameSnapshot: 'Room',
          adults: 1,
          childAges: [null],
        },
      ],
    },
  };
  expect(salesHotelCapacityError(state, [])).toBeNull();
  expect(
    salesPassengerStepError(state, false, 'stale capacity error'),
  ).toBeNull();
});
it('reports actual hotel errors, not missing services', () => {
  const state: SalesFormState = {
    ...base(),
    serviceKinds: ['FLIGHT', 'HOTEL'],
    hotel: { ...base().hotel, guestCustomerIds: ['person'] },
  };
  expect(salesPassengerStepError(state, false, 'capacity error')).toBe(
    'capacity error',
  );
  expect(salesPassengerStepError(state, false, null)).toBeNull();
});
it('still rejects missing hotel guests and genuinely unassigned passengers', () => {
  expect(
    salesPassengerStepError(
      {
        ...base(),
        serviceKinds: ['HOTEL'],
        hotel: { ...base().hotel, guestCustomerIds: [] },
      },
      false,
      null,
    ),
  ).toBe('حداقل یک مهمان برای هتل انتخاب کنید.');
  expect(
    salesPassengerStepError({ ...base(), serviceKinds: [] }, false, null),
  ).toBe('هر مسافر باید حداقل یک خدمت انتخاب‌شده داشته باشد.');
});
it('reports missing visa applicants and rejects stale or duplicate identities', () => {
  const state: SalesFormState = {
    ...base(),
    serviceKinds: ['FLIGHT', 'VISA'],
    visaComposition: { adults: 1, children: 0 },
    visaApplicantIds: ['removed'],
  };
  expect(salesPassengerStepError(state, false, null)).toBe(
    'افراد متقاضی ویزا را مطابق تعداد بزرگسال و کودک انتخاب کنید.',
  );
  expect(
    salesPassengerStepError(
      { ...state, visaApplicantIds: ['person'] },
      false,
      null,
    ),
  ).toBeNull();
  expect(
    salesPassengerStepError(
      {
        ...state,
        visaComposition: { adults: 2, children: 0 },
        visaApplicantIds: ['person', 'person'],
      },
      false,
      null,
    ),
  ).toBe('افراد متقاضی ویزا را مطابق تعداد بزرگسال و کودک انتخاب کنید.');
});
it('preserves identity confirmation, customer and service-date age-composition checks', () => {
  expect(salesPassengerStepError(base(), true, null)).toContain(
    'ثبت و تأیید افراد',
  );
  expect(
    salesPassengerStepError({ ...base(), customerId: '' }, false, null),
  ).toContain('مشتری');
  expect(
    salesPassengerStepError({ ...base(), departureDate: '' }, false, null),
  ).toBeNull();
  expect(
    salesPassengerStepError(
      {
        ...base(),
        passengerComposition: { adults: 2, children: 0, infants: 0 },
      },
      false,
      null,
    ),
  ).toContain('ترکیب ثبت‌شده');
});

it('legacy mode validates its customer confirmation without asking for passengers', () => {
  const state = { ...base(), legacyContract: true, passengers: [] };
  expect(salesPassengerStepError(state, false, null)).toBeNull();
  expect(salesPassengerStepError(state, true, null)).not.toBeNull();
  expect(
    salesPassengerStepError({ ...state, customerId: '' }, false, null),
  ).not.toBeNull();
});

it('validates age composition against hotel dates without a separate trip-start value', () => {
  const state = {
    ...base(),
    departureDate: '',
    serviceKinds: ['HOTEL' as const],
    hotel: {
      ...base().hotel,
      checkIn: '2099-10-01',
      checkOut: '2099-10-03',
      guestCustomerIds: ['person'],
    },
  };
  expect(salesPassengerStepError(state, false, null)).toBeNull();
  expect(
    salesPassengerStepError(
      {
        ...state,
        passengerComposition: { adults: 0, children: 1, infants: 0 },
      },
      false,
      null,
    ),
  ).toContain('ترکیب ثبت‌شده');
  expect(
    salesPassengerStepError(
      { ...state, passengers: [{ ...state.passengers[0]!, birthDate: '' }] },
      false,
      null,
    ),
  ).toContain('ترکیب ثبت‌شده');
  expect(
    salesPassengerStepError(
      {
        ...state,
        passengers: [
          { ...state.passengers[0]!, birthDate: '', ageCategory: 'ADT' },
        ],
      },
      false,
      null,
    ),
  ).toBeNull();
});
