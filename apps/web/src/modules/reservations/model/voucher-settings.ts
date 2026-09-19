import type { voucherNumberKeys, voucherFlagKeys } from '@nora/contracts';
import { voucherTextKeys, type VoucherSettingsV1 } from '@nora/contracts';
import {
  reservationFormData,
  reservationPassengerAgeLabel,
  type ReservationFormIntake,
  type ReservationFormReferences,
} from './reservation-form';
export function defaultVoucherSettings(
  intake: ReservationFormIntake,
  refs: ReservationFormReferences,
): VoucherSettingsV1 {
  const saved = intake.workflow.voucherSettings;
  const d = reservationFormData(intake, refs),
    h = intake.snapshot.hotelSelection;
  const text = Object.fromEntries(
    voucherTextKeys.map((k) => [k, '']),
  ) as VoucherSettingsV1['text'];
  Object.assign(text, {
    city: d.destination === '-' ? '' : d.destination,
    hotel: d.hotel === '-' ? '' : d.hotel,
    stars: d.stars === '-' ? '' : d.stars,
    meal: d.meal === '-' ? '' : d.meal,
    roomType: d.roomType === '-' ? '' : d.roomType,
    checkIn: h?.checkInDate ?? '',
    checkOut: h?.checkOutDate ?? '',
    broker: d.supplier === '-' ? '' : d.supplier,
    leaderName: d.leader === '-' ? '' : d.leader,
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
      age: p.age === 'CHD' ? 'CHD' : p.age === 'INF' ? 'INF' : 'ADL',
      hotelChildAgeBand: '',
    })),
  };
  if (!saved) return defaults;
  return {
    text: {
      ...(Object.fromEntries(
        voucherTextKeys.map((key) => [key, saved.text?.[key] ?? text[key]]),
      ) as VoucherSettingsV1['text']),
      contractPartyName:
        saved.text.contractPartyName ?? text.contractPartyName ?? '',
    },
    numbers: Object.fromEntries(
      (Object.keys(defaults.numbers) as (keyof typeof defaults.numbers)[]).map(
        (key) => [key, saved.numbers?.[key] ?? defaults.numbers[key]],
      ),
    ) as VoucherSettingsV1['numbers'],
    flags: Object.fromEntries(
      (Object.keys(defaults.flags) as (keyof typeof defaults.flags)[]).map(
        (key) => [key, saved.flags?.[key] ?? defaults.flags[key]],
      ),
    ) as VoucherSettingsV1['flags'],
    passengers: defaults.passengers.map((passenger) => ({
      ...passenger,
      ...saved.passengers?.find((item) => item.id === passenger.id),
    })),
  };
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
  leaderLanguage: 'زبان راهنما',
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
  if (!v) return d;
  const passengers = d.passengers
    .filter((p) => v.passengers.some((s) => s.id === p.id && s.selected))
    .map((p) => {
      const setting = v.passengers.find((s) => s.id === p.id)!;
      return {
        ...p,
        age: reservationPassengerAgeLabel(
          setting.age,
          setting.hotelChildAgeBand,
        ),
        hotelChildAgeBand: setting.hotelChildAgeBand,
        sex:
          setting.sex === 'MALE'
            ? 'Male'
            : setting.sex === 'FEMALE'
              ? 'Female'
              : '-',
      };
    });
  const nights =
    (Date.parse(v.text.checkOut) - Date.parse(v.text.checkIn)) / 86400000;
  return {
    ...d,
    hotel: v.text.hotel || '-',
    destination: v.text.city || '-',
    stars: v.text.stars || '-',
    meal: v.text.meal || '-',
    roomType: v.text.roomType || '-',
    checkIn: v.text.checkIn || '-',
    checkOut: v.text.checkOut || '-',
    rooms:
      v.numbers.singleRooms + v.numbers.doubleRooms + v.numbers.customRooms,
    double: v.numbers.doubleRooms,
    single: v.numbers.singleRooms,
    extra: v.numbers.extraBeds,
    nights: Number.isInteger(nights) && nights > 0 ? nights : '-',
    leader: v.flags.tourLeader
      ? v.text.leaderName || v.text.leaderLanguage || '-'
      : '-',
    excursion: v.flags.excursion ? v.text.excursionDescription || '-' : '-',
    notes: [v.text.stayNotes, v.text.remarks].filter(Boolean).join('\n'),
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
    adults: passengers.filter((p) => p.age === 'ADL').length,
    children: passengers.filter((p) => p.age.startsWith('CHD')).length,
    children2To6: passengers.filter(
      (p) => p.hotelChildAgeBand === 'CHD_2_TO_6',
    ).length,
    children6To12: passengers.filter(
      (p) => p.hotelChildAgeBand === 'CHD_6_TO_12',
    ).length,
    childrenUnclassified: passengers.filter(
      (p) =>
        p.age.startsWith('CHD') &&
        !['CHD_2_TO_6', 'CHD_6_TO_12'].includes(p.hotelChildAgeBand ?? ''),
    ).length,
    infants: passengers.filter((p) => p.age === 'INF').length,
    flights: (['arrival', 'departure'] as const).map((prefix) => ({
      leg: prefix === 'arrival' ? 'OUTBOUND' : 'RETURN',
      airline: v.text[`${prefix}Airline`] || '-',
      number: v.text[`${prefix}Flight`] || '-',
      date: v.text[`${prefix}Date`] || '-',
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
    ? voucherFormData(
        {
          ...intake,
          workflow: { ...intake.workflow, voucherSettings: settings },
        },
        refs,
      )
    : reservationFormData(intake, refs);
}
