import type { SalesContractCreateRequest } from './index';
import { moneyUnits, moneyDecimal } from './pricing';
import { SALES_CHEQUE_FEE } from './cheque-terms';

export function passengerOverSixty(
  birthDate: string,
  travelDate: string,
): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(travelDate)
  )
    return false;
  const birthday = new Date(`${birthDate}T00:00:00Z`);
  if (
    !Number.isFinite(birthday.getTime()) ||
    birthday.toISOString().slice(0, 10) !== birthDate
  )
    return false;
  const anniversary = `${Number(birthDate.slice(0, 4)) + 60}${birthDate.slice(4)}`;
  return travelDate > anniversary;
}
export function insuranceExtraRials(toman: string): string {
  if (!/^\d{1,15}$/.test(toman))
    throw new Error('هزینه اضافه بیمه باید مبلغ صحیح و نامنفی به تومان باشد.');
  return (BigInt(toman) * 10n).toString();
}
/** Surcharge is one separately priced service assigned only to its named passenger. */
export function validateInsuranceExtras(
  input: SalesContractCreateRequest,
): void {
  const seen = new Set<string>();
  const contractTotal =
    input.services.length > 0 &&
    input.services.every(
      (service) => service.metadata?.contractPackagePricingVersion === 1,
    );
  let surchargeTotal = 0n;
  for (const service of input.services) {
    if (service.metadata?.insuranceAgeSurcharge !== true) continue;
    const id = service.metadata.passengerId;
    const person = input.passengers.find((p) => p.customerId === id);
    const toman = service.metadata.extraToman;
    if (
      typeof id !== 'string' ||
      seen.has(id) ||
      !person ||
      !passengerOverSixty(person.birthDate, input.departureDate) ||
      typeof toman !== 'string' ||
      !input.services.some((s) => s.kind === 'INSURANCE')
    )
      throw new Error('هزینه اضافه بیمه با مسافر و خدمت بیمه مطابقت ندارد.');
    seen.add(id);
    const amount = insuranceExtraRials(toman);
    surchargeTotal += moneyUnits(amount);
    const price = service.pricing?.[0];
    if (
      service.kind !== 'OTHER' ||
      service.pricing?.length !== 1 ||
      !price ||
      price.currencyCode !== 'IRR' ||
      price.daySale.basis !== 'TOTAL' ||
      price.agreed.basis !== 'TOTAL' ||
      moneyUnits(price.daySale.amount) !== moneyUnits(amount) ||
      moneyUnits(price.agreed.amount) !== moneyUnits(amount) ||
      input.passengers.some(
        (p) =>
          p.serviceClientKeys.includes(service.clientKey) !==
          (p.customerId === id),
      )
    )
      throw new Error('مبلغ یا تخصیص هزینه اضافه بیمه معتبر نیست.');
    if (
      !contractTotal &&
      !person.agreedPrices?.some(
        (p) =>
          p.currencyCode === 'IRR' &&
          moneyUnits(p.amount) >= moneyUnits(amount),
      )
    )
      throw new Error('هزینه اضافه بیمه باید در جمع همان مسافر ثبت شود.');
  }
  if (contractTotal) {
    const total = input.priceComponents.reduce(
      (sum, part) =>
        part.currencyCode === 'IRR' &&
        (!input.paymentTerms || part.title !== SALES_CHEQUE_FEE)
          ? sum +
            moneyUnits(part.amount) * (part.type === 'DISCOUNT' ? -1n : 1n)
          : sum,
      0n,
    );
    if (total < surchargeTotal)
      throw new Error('مبلغ ریالی قرارداد باید هزینه اضافه بیمه را پوشش دهد.');
  }
}
export function addInsuranceExtra(
  prices: readonly { amount: string; currencyCode: string }[],
  toman: string,
) {
  const amount = insuranceExtraRials(toman);
  const current = prices.find((p) => p.currencyCode === 'IRR');
  return [
    ...prices.filter((p) => p.currencyCode !== 'IRR'),
    {
      currencyCode: 'IRR',
      amount: moneyDecimal(
        moneyUnits(current?.amount ?? '0') + moneyUnits(amount),
      ),
    },
  ];
}
