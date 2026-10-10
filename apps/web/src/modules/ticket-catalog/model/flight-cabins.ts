import type { ProductInput, Reference } from './catalog';

export type FlightCabinCapacity = {
  flightClassId: string;
  totalCapacity: number;
};

export function flightCabinCode(reference: Reference | undefined) {
  const text =
    `${reference?.code ?? ''} ${reference?.name ?? ''}`.toUpperCase();
  if (text.includes('FIRST') || text.includes('فرست')) return 'FIRST';
  if (text.includes('BUSINESS') || text.includes('بیزینس')) return 'BUSINESS';
  return 'ECONOMY';
}

/** Each cabin becomes an existing independent offer; seats and prices are never shared. */
export function expandFlightCabins(
  input: ProductInput,
  additional: readonly FlightCabinCapacity[],
  references: readonly Reference[],
): ProductInput[] {
  if (input.transport !== 'flight' || additional.length === 0) return [input];
  const cabins = [
    { flightClassId: input.flightClassId, totalCapacity: input.totalCapacity },
    ...additional,
  ];
  const seen = new Set<string>();
  return cabins.map((cabin) => {
    const reference = references.find(
      (item) =>
        item.kind === 'flightClass' &&
        item.id === cabin.flightClassId &&
        item.active,
    );
    if (!reference) throw new Error('کلاس پروازی همه ردیف‌ها را انتخاب کنید.');
    const code = flightCabinCode(reference);
    if (seen.has(code))
      throw new Error('هر کلاس پروازی را فقط یک بار اضافه کنید.');
    seen.add(code);
    if (
      !Number.isInteger(cabin.totalCapacity) ||
      cabin.totalCapacity < 0 ||
      cabin.totalCapacity > 100000
    )
      throw new Error('ظرفیت هر کلاس باید عدد صحیح بین صفر و ۱۰۰٬۰۰۰ باشد.');
    return {
      ...input,
      ...cabin,
      ...(input.tripGroupId
        ? { tripGroupId: `${input.tripGroupId}:${code}` }
        : {}),
      segments: input.segments.map((segment) => ({ ...segment })),
      fare: { ...input.fare },
    };
  });
}
