import { BadRequestException } from '@nestjs/common';
export const previewRateKinds = [
  'double',
  'single',
  'childWithBed',
  'extra',
] as const;
type PreviewRates = Record<(typeof previewRateKinds)[number], string>;
const isAmount = (value: unknown): value is string =>
  typeof value === 'string' && /^[1-9]\d{0,14}$/.test(value);
export type PreviewHotelRate = {
  checkIn: string;
  checkOut: string;
  amountIrr: string;
  breakdown?: {
    hotel: PreviewRates;
    hotels?: Record<string, PreviewRates>;
    adultFlightIrr: string;
    childFlightIrr: string;
  };
};

function previewHotelRate(value: unknown): PreviewHotelRate | null {
  if (value === null) return null;
  const rate = value as Partial<PreviewHotelRate> | null;
  const isDate = (day: unknown): day is string => {
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day))
      return false;
    const date = new Date(day + 'T00:00:00Z');
    return (
      Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day
    );
  };
  if (
    !rate ||
    !isDate(rate.checkIn) ||
    !isDate(rate.checkOut) ||
    rate.checkOut <= rate.checkIn ||
    typeof rate.amountIrr !== 'string' ||
    !/^[1-9]\d{0,14}$/.test(rate.amountIrr)
  )
    throw new BadRequestException('تنظیمات نمایش سایت معتبر نیست.');
  const breakdown = rate.breakdown;
  const hotels = breakdown?.hotels;
  if (
    hotels !== undefined &&
    (!hotels ||
      typeof hotels !== 'object' ||
      Array.isArray(hotels) ||
      !Object.keys(hotels).length ||
      Object.entries(hotels).some(
        ([id, prices]) =>
          !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id) ||
          !prices ||
          previewRateKinds.some((kind) => !isAmount(prices[kind])),
      ))
  )
    throw new BadRequestException('تنظیمات نمایش سایت معتبر نیست.');
  if (
    breakdown !== undefined &&
    (!breakdown?.hotel ||
      !isAmount(breakdown.adultFlightIrr) ||
      !isAmount(breakdown.childFlightIrr) ||
      previewRateKinds.some((kind) => !isAmount(breakdown.hotel[kind])))
  )
    throw new BadRequestException('تنظیمات نمایش سایت معتبر نیست.');
  return {
    checkIn: rate.checkIn,
    checkOut: rate.checkOut,
    amountIrr: rate.amountIrr,
    ...(breakdown
      ? {
          breakdown: {
            adultFlightIrr: breakdown.adultFlightIrr,
            childFlightIrr: breakdown.childFlightIrr,
            hotel: Object.fromEntries(
              previewRateKinds.map((kind) => [kind, breakdown.hotel[kind]]),
            ) as PreviewRates,
            ...(hotels
              ? {
                  hotels: Object.fromEntries(
                    Object.entries(hotels).map(([id, prices]) => [
                      id,
                      Object.fromEntries(
                        previewRateKinds.map((kind) => [kind, prices[kind]]),
                      ) as PreviewRates,
                    ]),
                  ),
                }
              : {}),
          },
        }
      : {}),
  };
}

export type WebsitePresentation = {
  title: string;
  description: string;
  commissionPercent: string;
  previewOnly?: boolean;
  publishHotelProfiles?: boolean;
  previewHotelRate?: PreviewHotelRate | null;
};
export function websitePresentation(value: unknown): WebsitePresentation {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('تنظیمات نمایش سایت معتبر نیست.');
  const v = value as Record<string, unknown>;
  if (
    typeof v.title !== 'string' ||
    v.title.length > 200 ||
    typeof v.description !== 'string' ||
    v.description.length > 5000 ||
    typeof v.commissionPercent !== 'string' ||
    !/^\d{1,3}(\.\d{1,4})?$/.test(v.commissionPercent) ||
    Number(v.commissionPercent) > 100 ||
    (v.previewOnly !== undefined && typeof v.previewOnly !== 'boolean') ||
    (v.publishHotelProfiles !== undefined &&
      typeof v.publishHotelProfiles !== 'boolean')
  )
    throw new BadRequestException('تنظیمات نمایش سایت معتبر نیست.');
  return {
    title: v.title.trim(),
    description: v.description.trim(),
    commissionPercent: v.commissionPercent,
    ...(v.previewHotelRate !== undefined
      ? { previewHotelRate: previewHotelRate(v.previewHotelRate) }
      : {}),
    ...(typeof v.previewOnly === 'boolean'
      ? { previewOnly: v.previewOnly }
      : {}),
    ...(typeof v.publishHotelProfiles === 'boolean'
      ? { publishHotelProfiles: v.publishHotelProfiles }
      : {}),
  };
}
