import type { SalesServicePricingV1 } from '@nora/contracts';

/** Temporary new-contract policy: the agreed price is the sale price. */
export function agreedSalePrice(
  price: SalesServicePricingV1,
): SalesServicePricingV1 {
  return { ...price, daySale: { ...price.agreed } };
}
export function agreedSalePricing(
  values: Record<string, SalesServicePricingV1[]>,
): Record<string, SalesServicePricingV1[]> {
  return Object.fromEntries(
    Object.entries(values).map(([key, prices]) => [
      key,
      prices.map(agreedSalePrice),
    ]),
  );
}
