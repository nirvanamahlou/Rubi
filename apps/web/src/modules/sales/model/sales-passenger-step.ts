import {
  salesHotelGuestIds,
  salesPassengerFlightDirections,
  salesPassengerCompositionMatches,
  salesTravelDate,
  type SalesFormState,
} from './sales-form';

/** One authoritative reason for both the passenger-step button and its message. */
export function salesPassengerStepError(
  state: SalesFormState,
  peopleDirty: boolean,
  hotelCapacityError: string | null,
): string | null {
  return (
    salesPassengerBlockers(state, peopleDirty, hotelCapacityError)[0] ?? null
  );
}

export function salesPassengerBlockers(
  state: SalesFormState,
  peopleDirty: boolean,
  hotelCapacityError: string | null,
): string[] {
  const reasons: string[] = [];
  if (!state.customerId) reasons.push('مشتری قرارداد را مشخص کنید.');
  if (state.legacyContract)
    return peopleDirty ? [...reasons, 'اطلاعات مشتری را تأیید کنید.'] : reasons;
  if (!state.passengers.length) reasons.push('حداقل یک مسافر اضافه کنید.');
  if (peopleDirty)
    reasons.push('اطلاعات جدول را با دکمه «ثبت و تأیید افراد» تأیید کنید.');
  if (salesTravelDate(state) && !salesPassengerCompositionMatches(state))
    reasons.push(
      'تعداد و رده سنی مسافران باید با ترکیب ثبت‌شده در مرحله اول یکسان باشد.',
    );
  const guests = salesHotelGuestIds(state);
  if (state.serviceKinds.includes('HOTEL')) {
    if (!guests.length) reasons.push('حداقل یک مهمان برای هتل انتخاب کنید.');
    if (hotelCapacityError) reasons.push(hotelCapacityError);
  }
  if (state.serviceKinds.includes('VISA')) {
    const selected = new Set(state.visaApplicantIds ?? []);
    const applicants = state.passengers.filter((p) =>
      selected.has(p.customerId),
    );
    if (
      !state.visaComposition ||
      applicants.length !==
        state.visaComposition.adults + state.visaComposition.children
    )
      reasons.push(
        'افراد متقاضی ویزا را مطابق تعداد بزرگسال و کودک انتخاب کنید.',
      );
  }
  const hasSharedService = state.serviceKinds.some(
    (kind) => kind !== 'HOTEL' && kind !== 'VISA' && kind !== 'FLIGHT',
  );
  const unassigned = state.passengers.filter(
    ({ customerId }) =>
      !(
        hasSharedService ||
        salesPassengerFlightDirections(state, customerId).length > 0 ||
        (state.serviceKinds.includes('HOTEL') && guests.includes(customerId)) ||
        (state.serviceKinds.includes('VISA') &&
          state.visaApplicantIds?.includes(customerId))
      ),
  );
  if (unassigned.length)
    reasons.push(
      'هر مسافر باید حداقل یک خدمت انتخاب‌شده داشته باشد.',
      ...unassigned.map(
        (p) => 'تخصیص خدمات — ردیف مسافر ' + (state.passengers.indexOf(p) + 1),
      ),
    );
  return reasons;
}
