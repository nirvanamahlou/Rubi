import { reservationHotelStays, type VoucherSettingsV1 } from '@nora/contracts';
import type {
  ReservationFormIntake,
  ReservationFormReferences,
} from './reservation-form';
import { hotelFormScope } from './hotel-form-scope';
import { defaultVoucherSettings } from './voucher-settings';
import type { TravelWorkflowStateV1 } from '@nora/contracts';

/** Existing scoped commands remain CAS-protected; never send before the last save. */
export async function saveHotelQuotationSequence<T>(
  quotations: readonly T[],
  expectedVersion: number,
  write: (
    quotation: T,
    version: number,
  ) => Promise<{ data: TravelWorkflowStateV1 }>,
  checkpoint: (state: TravelWorkflowStateV1) => void,
) {
  let result: { data: TravelWorkflowStateV1 } | undefined;
  for (const quotation of quotations) {
    result = await write(quotation, expectedVersion);
    checkpoint(result.data);
    expectedVersion = result.data.version;
  }
  if (!result) throw new Error('ذخیره انجام نشد.');
  return result;
}

export function hotelSupplierDraft(
  intake: ReservationFormIntake,
  refs: ReservationFormReferences,
) {
  const source = { ...intake, workflow: { ...intake.workflow } };
  delete source.workflow.voucherSettings;
  if (source.workflow.supplierFormSettings)
    source.workflow.voucherSettings = source.workflow.supplierFormSettings;
  return defaultVoucherSettings(source, refs);
}

/** Common identity/services, but never copy one hotel's rooms, dates or money to another. */
export function mergeSharedHotelDraft(
  primary: VoucherSettingsV1,
  hotel: VoucherSettingsV1,
): VoucherSettingsV1 {
  const result: VoucherSettingsV1 = {
    ...hotel,
    sharedHotelBroker: true,

    flags: { ...primary.flags },
    text: {
      ...hotel.text,
      broker: primary.text.broker,
      remarks: primary.text.remarks,
      contractPartyName: primary.text.contractPartyName ?? '',
      leaderLanguage: primary.text.leaderLanguage,
    },
    passengers: hotel.passengers.map((person) => {
      const common = primary.passengers.find((p) => p.id === person.id);
      return common
        ? {
            ...person,
            selected: common.selected,
            age: common.age,
            ...(common.hotelChildAgeBand !== undefined
              ? { hotelChildAgeBand: common.hotelChildAgeBand }
              : {}),
            ...(common.sex !== undefined ? { sex: common.sex } : {}),
          }
        : person;
    }),
  };
  if (primary.brokerId) result.brokerId = primary.brokerId;
  else delete result.brokerId;
  if (primary.leaderId) result.leaderId = primary.leaderId;
  else delete result.leaderId;
  return result;
}

export function sharedHotelDrafts(
  source: ReservationFormIntake,
  refs: ReservationFormReferences,
  primary: VoucherSettingsV1,
  edits: Record<string, VoucherSettingsV1>,
) {
  return reservationHotelStays(source.snapshot).map((stay, index) => {
    const intake = hotelFormScope(source, stay.key);
    return {
      stay,
      intake,
      settings: index
        ? mergeSharedHotelDraft(
            primary,
            edits[stay.key] ?? hotelSupplierDraft(intake, refs),
          )
        : primary,
    };
  });
}
