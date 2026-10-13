export interface PackageTourPriceFieldV1 {
  id: string;
  title: string;
  kind: 'adultFlight' | 'childFlight' | 'business' | 'commission' | 'custom';
  amount: string;
  currencyCode: string;
  mode: 'fixed' | 'percent';
}

type LegacyPrices = {
  priceFields?: readonly PackageTourPriceFieldV1[] | undefined;
  currencyCode?: string;
  adultFlightSale?: string;
  adultFlightSaleCurrencyCode?: string;
  childFlightSale?: string;
  childFlightSaleCurrencyCode?: string;
  businessUplift?: string;
  businessUpliftCurrencyCode?: string;
  commissionPercent?: string;
  commissionMode?: 'fixed' | 'percent';
  commissionAmount?: string;
  commissionCurrencyCode?: string;
};

/** Missing historical fields restore defaults; an explicit empty list stays empty. */
export function tourPriceFields(
  value: LegacyPrices = {},
): PackageTourPriceFieldV1[] {
  if (value.priceFields !== undefined)
    return value.priceFields.map((row) => ({ ...row }));
  const currency = value.currencyCode ?? 'IRR';
  return [
    {
      id: 'adultFlight',
      title: 'قیمت فروش پرواز بزرگسال',
      kind: 'adultFlight',
      amount: value.adultFlightSale ?? '0',
      currencyCode: value.adultFlightSaleCurrencyCode ?? currency,
      mode: 'fixed',
    },
    {
      id: 'childFlight',
      title: 'قیمت فروش پرواز کودک',
      kind: 'childFlight',
      amount: value.childFlightSale ?? '0',
      currencyCode: value.childFlightSaleCurrencyCode ?? currency,
      mode: 'fixed',
    },
    {
      id: 'business',
      title: 'افزایش نرخ بیزینس',
      kind: 'business',
      amount: value.businessUplift ?? '0',
      currencyCode: value.businessUpliftCurrencyCode ?? currency,
      mode: 'fixed',
    },
    {
      id: 'commission',
      title: 'کمیسیون',
      kind: 'commission',
      amount:
        value.commissionMode === 'fixed'
          ? (value.commissionAmount ?? '0')
          : (value.commissionPercent ?? '0'),
      currencyCode: value.commissionCurrencyCode ?? currency,
      mode: value.commissionMode ?? 'percent',
    },
  ];
}

export function validateTourPriceFields(
  value: unknown,
): PackageTourPriceFieldV1[] {
  if (!Array.isArray(value) || value.length > 50)
    throw new Error('ردیف‌های قیمت معتبر نیستند.');
  const ids = new Set<string>();
  const kinds = new Set<string>();
  return value.map((row: PackageTourPriceFieldV1) => {
    if (
      !row ||
      typeof row.id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(row.id) ||
      ids.has(row.id) ||
      typeof row.title !== 'string' ||
      !row.title.trim() ||
      row.title.trim().length > 120 ||
      ![
        'adultFlight',
        'childFlight',
        'business',
        'commission',
        'custom',
      ].includes(row.kind) ||
      (row.kind !== 'custom' && kinds.has(row.kind)) ||
      !['fixed', 'percent'].includes(row.mode) ||
      (row.kind !== 'commission' && row.mode !== 'fixed') ||
      typeof row.currencyCode !== 'string' ||
      !/^[A-Z]{3}$/.test(row.currencyCode) ||
      typeof row.amount !== 'string' ||
      !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(row.amount)
    )
      throw new Error('ردیف قیمت، نام، مبلغ یا ارز معتبر نیست.');
    const [whole = '0', fraction = ''] = row.amount.split('.');
    const precision =
      row.mode === 'percent' || row.currencyCode !== 'IRR' ? 2 : 0;
    if (
      whole.length > 20 ||
      fraction.length > precision ||
      (row.mode === 'percent' &&
        (BigInt(whole) > 100n ||
          (BigInt(whole) === 100n && /[1-9]/.test(fraction))))
    )
      throw new Error('دقت مبلغ یا درصد قیمت معتبر نیست.');
    ids.add(row.id);
    kinds.add(row.kind);
    return {
      id: row.id,
      title: row.title.trim(),
      kind: row.kind,
      amount: row.amount,
      currencyCode: row.currencyCode,
      mode: row.mode,
    };
  });
}

export function tourPriceFieldValues(
  fields: readonly PackageTourPriceFieldV1[],
) {
  const find = (kind: PackageTourPriceFieldV1['kind']) =>
    fields.find((row) => row.kind === kind);
  const adult = find('adultFlight'),
    child = find('childFlight'),
    business = find('business'),
    commission = find('commission');
  return {
    adultFlightSale: adult?.amount ?? '0',
    adultFlightSaleCurrencyCode: adult?.currencyCode ?? 'IRR',
    childFlightSale: child?.amount ?? '0',
    childFlightSaleCurrencyCode: child?.currencyCode ?? 'IRR',
    businessUplift: business?.amount ?? '0',
    businessUpliftCurrencyCode: business?.currencyCode ?? 'IRR',
    commissionPercent: commission?.mode === 'percent' ? commission.amount : '0',
    commissionMode: commission?.mode ?? 'fixed',
    commissionAmount: commission?.mode === 'fixed' ? commission.amount : '0',
    commissionCurrencyCode: commission?.currencyCode ?? 'IRR',
  };
}
