import { CatalogError, utc, type Product } from './catalog';

export type TripType = 'one-way' | 'round-trip';
export interface ProductSelection {
  productId: string;
  productVersion: number;
}

function independentCandidate(product: Product) {
  return product.status === 'draft' || product.status === 'active';
}
function sameEndpoint(
  a: Product['definition']['segments'][number],
  aSide: 'origin' | 'destination',
  b: Product['definition']['segments'][number],
  bSide: 'origin' | 'destination',
) {
  const aa = a[`${aSide}AirportId`];
  const ba = b[`${bSide}AirportId`];
  if (aa && ba) return aa === ba;
  const ac = a[`${aSide}CityId`];
  const bc = b[`${bSide}CityId`];
  const country = a[`${aSide}CountryId`];
  return Boolean(
    ac && bc && country && ac === bc && country === b[`${bSide}CountryId`],
  );
}
export function compatibleReturn(outbound: Product, inbound: Product): boolean {
  if (
    outbound.id === inbound.id ||
    !independentCandidate(outbound) ||
    !independentCandidate(inbound)
  )
    return false;
  const outFirst = outbound.definition.segments[0];
  const outLast = outbound.definition.segments.at(-1);
  const inFirst = inbound.definition.segments[0];
  const inLast = inbound.definition.segments.at(-1);
  if (!outFirst || !outLast || !inFirst || !inLast) return false;
  try {
    return (
      utc(inFirst.departureAt) > utc(outLast.arrivalAt) &&
      sameEndpoint(outLast, 'destination', inFirst, 'origin') &&
      sameEndpoint(outFirst, 'origin', inLast, 'destination')
    );
  } catch {
    return false;
  }
}
export function previewTripCandidates(
  products: readonly Product[],
  outbound?: Product,
): Product[] {
  return products.filter(
    (product) =>
      independentCandidate(product) &&
      (!outbound || compatibleReturn(outbound, product)),
  );
}

// This is a selection proposal only: no sale price, inventory mutation or reservation.
// Sales must resolve/re-authorize current sellable products and snapshot its own dynamic price.
export function composePreviewJourney(
  products: readonly Product[],
  type: TripType,
  outbound: ProductSelection,
  inbound?: ProductSelection,
) {
  function resolve(selection: ProductSelection) {
    const product = products.find((row) => row.id === selection.productId);
    if (!product || product.version !== selection.productVersion)
      throw new CatalogError(
        'CONFLICT',
        'بلیت انتخابی تغییر کرده است؛ دوباره انتخاب کنید.',
      );
    if (!independentCandidate(product))
      throw new CatalogError(
        'TRANSITION',
        'بلیت متوقف یا لغوشده قابل انتخاب نیست.',
      );
    return product;
  }
  const out = resolve(outbound);
  if (type === 'one-way') {
    if (inbound)
      throw new CatalogError(
        'VALIDATION',
        'سفر یک‌طرفه نباید انتخاب برگشت داشته باشد.',
      );
    return {
      type,
      legs: [{ ...outbound }],
      pricingOwner: 'sales' as const,
      previewOnly: true as const,
    };
  }
  if (type !== 'round-trip' || !inbound)
    throw new CatalogError(
      'VALIDATION',
      'برای رفت‌وبرگشت بلیت برگشت را انتخاب کنید.',
    );
  if (!compatibleReturn(out, resolve(inbound)))
    throw new CatalogError(
      'VALIDATION',
      'برگشت باید بلیت مستقلی با مسیر معکوس و حرکت بعد از رسیدن رفت باشد.',
    );
  return {
    type,
    legs: [{ ...outbound }, { ...inbound }],
    pricingOwner: 'sales' as const,
    previewOnly: true as const,
  };
}
