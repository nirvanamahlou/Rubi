import { contractRoomDefaults } from './contract-room-defaults';
import { salesRoomCategoryLabel } from '@nora/contracts';
import { salesHotelRoomSummary } from '@nora/contracts';
import type { voucherNumberKeys, voucherFlagKeys } from '@nora/contracts';
import { voucherTextKeys, type VoucherSettingsV1 } from '@nora/contracts';
import {
  reservationFormData,
  isAggregateReservationForm,
  englishOutputName,
  reservationFormDate,
  reservationPassengerAgeLabel,
  type ReservationFormIntake,
  type ReservationFormReferences,
} from './reservation-form';
export function defaultVoucherSettings(
  intake: ReservationFormIntake,
  refs: ReservationFormReferences,
): VoucherSettingsV1 {
  const saved =
    intake.workflow.voucherSettings ?? intake.workflow.sentSupplierFormSettings;
  const d = reservationFormData(intake, refs),
    h = intake.snapshot.hotelSelection;
  const text = Object.fromEntries(
    voucherTextKeys.map((k) => [k, '']),
  ) as VoucherSettingsV1['text'];
  Object.assign(text, {
    contractPartyName: intake.contractPartyName ?? '',
    city: d.destination === '-' ? '' : d.destination,
    hotel: d.hotel === '-' ? '' : d.hotel,
    stars: d.stars === '-' ? '' : d.stars,
    meal: d.meal === '-' ? '' : d.meal,
    roomType: d.roomType === '-' ? '' : d.roomType,
    checkIn: h?.checkInDate ?? '',
    checkOut: h?.checkOutDate ?? '',
    broker: d.supplier === '-' ? '' : d.supplier,
    leaderName: d.leader === '-' ? '' : d.leader,
    leaderLanguage: 'Persian',
    excursionDescription: d.excursion === '-' ? '' : d.excursion,
  });
  for (const [prefix, f] of [
    ['arrival', d.flights.find((f) => f.leg === 'OUTBOUND')],
    ['departure', d.flights.find((f) => f.leg === 'RETURN')],
  ] as const)
    if (f) {
      text[`${prefix}Airline`] = f.airline;
      text[`${prefix}Flight`] = f.number;
      text[`${prefix}Date`] = Number.isFinite(Date.parse(f.date))
        ? new Date(f.date).toISOString().slice(0, 10)
        : '';
      text[`${prefix}Time`] = f.time;
    }
  const defaults: VoucherSettingsV1 = {
    hotelTransferCounts: { outbound: 0, returning: 0 },
    ...(h?.rooms?.length
      ? {
          rooms: h.rooms.map((room) => ({
            ordinal: room.ordinal,
            roomTypeNameSnapshot:
              d.roomBreakdown.find((r) => r.ordinal === room.ordinal)
                ?.roomType || room.roomTypeNameSnapshot,
            adults: room.adults,
            childAges: [...room.childAges],
          })),
        }
      : {}),
    text,
    numbers: {
      singleRooms: Number(d.single) || 0,
      doubleRooms: Number(d.double) || 0,
      extraBeds: Number(d.extra) || 0,
      customRooms:
        (Number(d.single) || 0) + (Number(d.double) || 0) === 0
          ? Number(d.rooms) || 0
          : 0,
    },
    flags: {
      withLetterhead: true,
      hotel: !!h,
      transfer: intake.snapshot.serviceSelections.some(
        (s) => s.kind === 'TRANSFER',
      ),
      tourLeader: d.leader !== '-',
      excursion: d.excursion !== '-',
      specialRoom: false,
    },
    passengers: d.passengers.map((p) => ({
      id: p.id,
      selected: true,
      roomType: text.roomType,
      services: {
        outboundFlight: p.outboundFlight,
        returnFlight: p.returnFlight,
        outboundTransfer: p.outboundTransfer,
        returnTransfer: p.returnTransfer,
        hotel: Boolean(p.checkIn && p.checkIn !== '-'),
      },
      sex: p.sex === 'Female' ? 'FEMALE' : 'MALE',
      age: p.age.startsWith('CHD') ? 'CHD' : p.age === 'INF' ? 'INF' : 'ADL',
      hotelChildAgeBand: (p.hotelChildAgeBand ?? '') as
        'CHD_2_TO_6' | 'CHD_6_TO_12' | '',
    })),
  };
  if (!saved) return contractRoomDefaults(defaults);
  return contractRoomDefaults({
    ...(saved.hotelTransferSeparate !== undefined
      ? { hotelTransferSeparate: saved.hotelTransferSeparate }
      : {}),
    ...(saved.hotelTransferSplit !== undefined
      ? { hotelTransferSplit: saved.hotelTransferSplit }
      : {}),
    ...(saved.hotelTransferReturn
      ? { hotelTransferReturn: { ...saved.hotelTransferReturn } }
      : {}),
    ...(saved.hotelRoomPrices
      ? { hotelRoomPrices: structuredClone(saved.hotelRoomPrices) }
      : {}),
    hotelTransferCounts: {
      ...(saved.hotelTransferCounts ?? defaults.hotelTransferCounts!),
    },
    ...(saved.supplierFormPrices !== undefined
      ? { supplierFormPrices: structuredClone(saved.supplierFormPrices) }
      : {}),
    ...(saved.rooms !== undefined
      ? {
          rooms: saved.rooms.map((room) => ({
            ...room,
            childAges: [...room.childAges],
          })),
        }
      : defaults.rooms
        ? { rooms: defaults.rooms }
        : {}),
    ...(saved.hotelPurchasePrices !== undefined
      ? {
          hotelPurchasePrices: saved.hotelPurchasePrices.map((p) => ({ ...p })),
        }
      : {}),
    ...(saved.brokerId ? { brokerId: saved.brokerId } : {}),
    ...(saved.leaderId ? { leaderId: saved.leaderId } : {}),
    ...(saved.transferBrokerId
      ? { transferBrokerId: saved.transferBrokerId }
      : {}),
    ...(saved.transferBrokerName !== undefined
      ? { transferBrokerName: saved.transferBrokerName }
      : {}),
    ...(saved.transferDetailsOverride !== undefined
      ? { transferDetailsOverride: saved.transferDetailsOverride }
      : {}),
    text: {
      ...(Object.fromEntries(
        voucherTextKeys.map((key) => [key, saved.text?.[key] ?? text[key]]),
      ) as VoucherSettingsV1['text']),
      hotel:
        saved.text.hotel === h?.hotelNameSnapshot
          ? text.hotel
          : englishOutputName(saved.text.hotel || text.hotel, refs),
      contractPartyName:
        saved.text.contractPartyName ?? text.contractPartyName ?? '',
      leaderLanguage: saved.text.leaderLanguage || 'Persian',
    },
    numbers: h?.rooms?.length
      ? defaults.numbers
      : (Object.fromEntries(
          (
            Object.keys(defaults.numbers) as (keyof typeof defaults.numbers)[]
          ).map((key) => [key, saved.numbers?.[key] ?? defaults.numbers[key]]),
        ) as VoucherSettingsV1['numbers']),
    flags: Object.fromEntries(
      (Object.keys(defaults.flags) as (keyof typeof defaults.flags)[]).map(
        (key) => [key, saved.flags?.[key] ?? defaults.flags[key]],
      ),
    ) as VoucherSettingsV1['flags'],
    passengers: defaults.passengers.map((passenger) => ({
      ...passenger,
      ...saved.passengers?.find((item) => item.id === passenger.id),
      sex:
        saved.passengers?.find((item) => item.id === passenger.id)?.sex ||
        passenger.sex ||
        '',
      hotelChildAgeBand:
        saved.passengers?.find((item) => item.id === passenger.id)
          ?.hotelChildAgeBand ||
        passenger.hotelChildAgeBand ||
        '',
    })),
  });
}
export type VoucherTextFieldKey =
  (typeof voucherTextKeys)[number] | 'contractPartyName';
export const voucherTextLabels: Record<VoucherTextFieldKey, string> = {
  contractPartyName: 'نام طرف قرارداد',
  country: 'کشور',
  city: 'شهر',
  hotel: 'نام هتل (انگلیسی)',
  stars: 'درجه هتل',
  meal: 'سرویس هتل',
  roomType: 'نوع اتاق',
  checkIn: 'ورود',
  checkOut: 'خروج',
  website: 'وب‌سایت هتل',
  stayNotes: 'توضیح اقامت',
  broker: 'کارگزار',
  leaderLanguage: 'متن راهنما در فرم (پیش‌فرض Persian)',
  leaderName: 'نام راهنما',
  leaderPhone: 'تلفن راهنما',
  transferBoard: 'تابلوی ترانسفر',
  transferPhone: 'تلفن ترانسفر',
  transferKind: 'نوع ترانسفر (RT / OW)',
  excursionDescription: 'گشت (لاتین)',
  extraServices: 'سایر خدمات',
  remarks: 'توضیحات برای کارگزار (لاتین)',
  arrivalAirline: 'ایرلاین ورود',
  arrivalFlight: 'شماره پرواز ورود',
  arrivalDate: 'تاریخ ورود پرواز',
  arrivalTime: 'ساعت ورود',
  departureAirline: 'ایرلاین خروج',
  departureFlight: 'شماره پرواز خروج',
  departureDate: 'تاریخ خروج پرواز',
  departureTime: 'ساعت خروج',
};
export const voucherNumberLabels: Record<
  (typeof voucherNumberKeys)[number],
  string
> = {
  singleRooms: 'SGL',
  doubleRooms: 'DBL',
  extraBeds: 'EXT',
  customRooms: 'CUSTOM',
};
export const voucherFlagLabels: Record<
  (typeof voucherFlagKeys)[number],
  string
> = {
  withLetterhead: 'با سربرگ',
  hotel: 'هتل',
  transfer: 'ترانسفر',
  tourLeader: 'راهنما',
  excursion: 'گشت',
  specialRoom: 'اتاق خاص',
};

export function voucherFormData(
  intake: ReservationFormIntake,
  refs: ReservationFormReferences,
) {
  const d = reservationFormData(intake, refs),
    v = intake.workflow.voucherSettings;
  if (!v) return { ...d, supplier: '0' };
  const passengers = d.passengers
    .filter((p) => v.passengers.some((s) => s.id === p.id && s.selected))
    .map((p) => {
      const setting = v.passengers.find((s) => s.id === p.id)!;
      return {
        ...p,
        age: reservationPassengerAgeLabel(
          setting.age,
          setting.hotelChildAgeBand || p.hotelChildAgeBand,
        ),
        hotelChildAgeBand:
          setting.age === 'CHD'
            ? setting.hotelChildAgeBand || p.hotelChildAgeBand
            : '',
        sex:
          setting.sex === 'MALE'
            ? 'Male'
            : setting.sex === 'FEMALE'
              ? 'Female'
              : p.sex,
      };
    });
  const roomSummary = v.rooms ? salesHotelRoomSummary(v.rooms) : undefined;
  const nights =
    (Date.parse(v.text.checkOut) - Date.parse(v.text.checkIn)) / 86400000;
  return {
    ...d,
    ...(v.rooms !== undefined
      ? {
          roomBreakdown: v.rooms.map((room) => ({
            ordinal: room.ordinal,
            roomType: (() => {
              const value = englishOutputName(room.roomTypeNameSnapshot, refs);
              const original = intake.snapshot.hotelSelection?.rooms?.find(
                (r) => r.ordinal === room.ordinal,
              );
              const label = original?.roomCategory
                ? salesRoomCategoryLabel(original.roomCategory, original.adults)
                : '';
              return label && !value.endsWith(' · ' + label)
                ? value + ' · ' + label
                : value;
            })(),
            adults: room.adults,
            childAges: [...room.childAges],
          })),
        }
      : {}),
    supplier: '0',
    hotel: englishOutputName(v.text.hotel || '-', refs),
    destination: englishOutputName(v.text.city || '-', refs),
    stars: v.text.stars || '-',
    meal: englishOutputName(v.text.meal || '-', refs),
    roomType: englishOutputName(v.text.roomType || '-', refs),
    checkIn: voucherDate(v.text.checkIn),
    checkOut: voucherDate(v.text.checkOut),
    rooms:
      v.rooms !== undefined
        ? v.rooms.length
        : d.roomBreakdown.length
          ? d.rooms
          : v.numbers.singleRooms +
            v.numbers.doubleRooms +
            v.numbers.customRooms,
    double:
      roomSummary?.doubleRoomCount ??
      (d.roomBreakdown.length ? d.double : v.numbers.doubleRooms),
    single:
      roomSummary?.singleRoomCount ??
      (d.roomBreakdown.length ? d.single : v.numbers.singleRooms),
    extra:
      roomSummary?.extraBedCount ??
      (d.roomBreakdown.length ? d.extra : v.numbers.extraBeds),
    nights: Number.isInteger(nights) && nights > 0 ? nights : '-',
    leader: v.flags.tourLeader
      ? [v.text.leaderName, v.text.leaderPhone].filter(Boolean).join(' / ') ||
        '-'
      : '-',
    excursion: v.flags.excursion ? v.text.excursionDescription || '-' : '-',
    notes: intake.workflow.voucherIssued
      ? intake.workflow.note
      : [v.text.stayNotes, v.text.remarks].filter(Boolean).join('\n'),
    services: [
      v.flags.hotel ? 'HOTEL' : '',
      v.flags.transfer ? 'TRANSFER' : '',
      v.flags.tourLeader ? 'TOUR LEADER' : '',
      v.flags.excursion ? 'EXCURSION' : '',
      v.text.extraServices,
    ]
      .filter(Boolean)
      .join(' / '),
    passengers,
    contractPartyName: v.text.contractPartyName || d.contractPartyName,
    adults: isAggregateReservationForm(intake)
      ? d.adults
      : passengers.filter((p) => p.age === 'ADL').length,
    children: isAggregateReservationForm(intake)
      ? d.children
      : passengers.filter((p) => p.age.startsWith('CHD')).length,
    children2To6: passengers.filter((p) => p.hotelChildAgeBand === 'CHD_2_TO_6')
      .length,
    children6To12: passengers.filter(
      (p) => p.hotelChildAgeBand === 'CHD_6_TO_12',
    ).length,
    childrenUnclassified: isAggregateReservationForm(intake)
      ? d.children
      : passengers.filter(
          (p) =>
            p.age.startsWith('CHD') &&
            !['CHD_2_TO_6', 'CHD_6_TO_12'].includes(p.hotelChildAgeBand ?? ''),
        ).length,
    infants: isAggregateReservationForm(intake)
      ? d.infants
      : passengers.filter((p) => p.age === 'INF').length,
    flights: (['arrival', 'departure'] as const).map((prefix) => ({
      leg: prefix === 'arrival' ? 'OUTBOUND' : 'RETURN',
      airline: englishOutputName(v.text[`${prefix}Airline`] || '-', refs),
      number: v.text[`${prefix}Flight`] || '-',
      date: voucherDate(v.text[`${prefix}Date`]),
      time: v.text[`${prefix}Time`] || '-',
    })),
  };
}

export function supplierFormData(
  intake: ReservationFormIntake,
  refs: ReservationFormReferences = {},
) {
  const settings = intake.workflow.supplierFormSettings;
  return settings
    ? {
        ...voucherFormData(
          {
            ...intake,
            workflow: { ...intake.workflow, voucherSettings: settings },
          },
          refs,
        ),
        notes: [settings.text.stayNotes, settings.text.remarks]
          .filter(Boolean)
          .join('\n'),
        passengers: voucherFormData(
          {
            ...intake,
            workflow: { ...intake.workflow, voucherSettings: settings },
          },
          refs,
        ).passengers.map((person) => {
          const saved = settings.passengers.find((p) => p.id === person.id);
          return {
            ...person,
            hotelChildAgeBand: person.hotelChildAgeBand,
            ...(intake.supplierDocumentKind &&
            intake.supplierDocumentKind !== 'HOTEL'
              ? { otherServices: '-' }
              : {}),
            ...(saved?.services
              ? {
                  outboundFlight: saved.services.outboundFlight,
                  returnFlight: saved.services.returnFlight,
                  outboundTransfer: saved.services.outboundTransfer,
                  returnTransfer: saved.services.returnTransfer,
                  checkIn: saved.services.hotel
                    ? person.checkIn && person.checkIn !== '-'
                      ? person.checkIn
                      : voucherDate(settings.text.checkIn)
                    : '-',
                  checkOut: saved.services.hotel
                    ? person.checkOut && person.checkOut !== '-'
                      ? person.checkOut
                      : voucherDate(settings.text.checkOut)
                    : '-',
                }
              : {}),
          };
        }),
        ...(intake.supplierDocumentKind
          ? {
              transfer:
                intake.supplierDocumentKind === 'HOTEL'
                  ? '-'
                  : (intake.supplierDocumentKind === 'RETURN'
                      ? 'RETURN ONLY'
                      : intake.supplierDocumentKind === 'OUTBOUND'
                        ? 'OUTBOUND ONLY'
                        : 'ROUND TRIP') +
                    ' · ' +
                    ((settings.hotelTransferCounts?.outbound ?? 0) +
                      (settings.hotelTransferCounts?.returning ?? 0)) +
                    ' PAX',
            }
          : {}),
        supplier: englishOutputName(settings.text.broker?.trim() || '-', refs),
        leader: settings.text.leaderLanguage?.trim() || 'Persian',
      }
    : {
        ...reservationFormData(intake, refs),
        passengers: reservationFormData(intake, refs).passengers.map(
          (person) => ({
            ...person,
            hotelChildAgeBand: person.hotelChildAgeBand,
          }),
        ),
        leader: 'Persian',
      };
}

/** Stored ISO dates must use the same Gregorian display in previews and PDFs. */
function voucherDate(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)
    ? reservationFormDate(value)
    : value || '-';
}

/** Supplier quotation defaults must never inherit the voucher's different broker. */
export function defaultSupplierFormSettings(
  intake: ReservationFormIntake,
  refs: ReservationFormReferences = {},
) {
  const source = { ...intake, workflow: { ...intake.workflow } };
  delete source.workflow.voucherSettings;
  if (source.workflow.supplierFormSettings)
    source.workflow.voucherSettings = source.workflow.supplierFormSettings;
  return defaultVoucherSettings(source, refs);
}
