import {
  readPassengerHotelStays,
  type SalesContractAmendmentV1,
  type SalesPassengerInput,
  type SalesPassengerAgeCategory,
  type SalesMoney,
} from '@nora/contracts';
import {
  amendmentPassengerGross,
  amendmentPricingDeductions,
  applyAmendmentPassengerPrices,
} from './amendment-passenger-prices';

/** Change contract links and their prices together; never delete a Customer identity. */
export function assertAmendmentMembershipPricing(
  draft: SalesContractAmendmentV1,
) {
  if (draft.passengers.some((p) => !p.agreedPrices?.length))
    throw Error(
      'پیش از تغییر فهرست مسافران، قیمت هر مسافر را در جدول قیمت مشخص کنید.',
    );
}
export function changeAmendmentMembership(
  draft: SalesContractAmendmentV1,
  change:
    | {
        add: SalesPassengerInput;
        category: SalesPassengerAgeCategory;
        prices: SalesMoney[];
      }
    | { remove: string },
): SalesContractAmendmentV1 {
  assertAmendmentMembershipPricing(draft);
  const gross = amendmentPassengerGross(draft);
  const deductions = amendmentPricingDeductions(draft);
  const categories = { ...draft.passengerCategories };
  let passengers = [...draft.passengers];
  if ('add' in change) {
    if (passengers.some((p) => p.customerId === change.add.customerId))
      throw Error('این مسافر قبلاً به قرارداد اضافه شده است.');
    if (!change.add.serviceClientKeys.length)
      throw Error('حداقل یک خدمت برای مسافر انتخاب کنید.');
    passengers.push(change.add);
    categories[change.add.customerId] = change.category;
    gross[change.add.customerId] = change.prices;
  } else {
    passengers = passengers.filter((p) => p.customerId !== change.remove);
    if (!passengers.length)
      throw Error('حداقل یک مسافر باید در قرارداد باقی بماند.');
    delete categories[change.remove];
    delete gross[change.remove];
    delete deductions[change.remove];
  }
  const ids = new Set(passengers.map((p) => p.customerId));
  const stays = readPassengerHotelStays(draft.services, draft.hotelSelection);
  const next = {
    ...draft,
    passengers,
    passengerCategories: categories,
    services: draft.services
      .filter(
        (s) =>
          !(
            s.metadata?.insuranceAgeSurcharge === true &&
            !ids.has(String(s.metadata.passengerId))
          ),
      )
      .map((s) => {
        const metadata = { ...s.metadata };
        if (!draft.passengers.length && 'add' in change)
          delete metadata.legacyContractV1;
        if (s.kind === 'TRANSFER')
          metadata.passengerCount = passengers.filter((p) =>
            p.serviceClientKeys.includes(s.clientKey),
          ).length;
        if (s.clientKey === draft.hotelSelection?.serviceClientKey && stays) {
          metadata.passengerHotelStaysV1 = JSON.stringify(
            Object.fromEntries(
              passengers
                .filter((p) => p.serviceClientKeys.includes(s.clientKey))
                .map((p) => [
                  p.customerId,
                  stays[p.customerId] ?? {
                    different: false,
                    checkInDate: draft.hotelSelection!.checkInDate,
                    checkOutDate: draft.hotelSelection!.checkOutDate,
                  },
                ]),
            ),
          );
        }
        return { ...s, metadata };
      }),
  };
  return applyAmendmentPassengerPrices(next, gross, deductions);
}
