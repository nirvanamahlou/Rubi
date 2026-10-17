import { moneyDecimal, moneyUnits } from '@nora/contracts';
export function purchaseFxPaymentPreview(
  amount: string,
  baselineRate: string | null,
  actualRate: string,
) {
  const convert = (rate: string) => {
    if (!/^(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$/.test(rate))
      throw new Error('rate');
    const [whole, fraction = ''] = rate.split('.');
    const rateUnits =
      BigInt(whole!) * 100000000n + BigInt(fraction.padEnd(8, '0'));
    if (rateUnits <= 0n) throw new Error('rate');
    return (moneyUnits(amount) * rateUnits + 50000000n) / 100000000n;
  };
  try {
    if (!baselineRate || moneyUnits(amount) <= 0n) return null;
    const baseline = convert(baselineRate),
      actual = convert(actualRate);
    return {
      baseline: moneyDecimal(baseline),
      actual: moneyDecimal(actual),
      gainLoss: moneyDecimal(baseline - actual),
    };
  } catch {
    return null;
  }
}
