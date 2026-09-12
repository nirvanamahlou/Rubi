export type PriceProductType = 'TOUR' | 'OWN_TICKET';
export type PriceCurrency = 'IRR' | 'USD' | 'EUR' | 'AED' | 'TRY';

export interface DailyPriceItem {
  id: string;
  version: number;
  productType: PriceProductType;
  productName: string;
  serviceCode: string;
  routeLabel: string;
  serviceDate: string;
  currentPrice: string;
  draftPrice: string;
  currencyCode: PriceCurrency;
  capacityLabel: string;
  ownInventory: boolean;
  featured: boolean;
}

export const pricingPreviewDate = '2026-09-12';

export const pricingPreviewItems: readonly DailyPriceItem[] = [
  {
    id: 'preview-tour-antalya-001',
    version: 1,
    productType: 'TOUR',
    productName: 'تور آنتالیا ۶ شب',
    serviceCode: 'TOUR-ANT-0612',
    routeLabel: 'تهران ← آنتالیا',
    serviceDate: pricingPreviewDate,
    currentPrice: '485000000',
    draftPrice: '485000000',
    currencyCode: 'IRR',
    capacityLabel: '۱۲ نفر باقی‌مانده',
    ownInventory: true,
    featured: true,
  },
  {
    id: 'preview-ticket-ist-001',
    version: 1,
    productType: 'OWN_TICKET',
    productName: 'پرواز رفت استانبول',
    serviceCode: 'NS-IST-204',
    routeLabel: 'تهران ← استانبول',
    serviceDate: pricingPreviewDate,
    currentPrice: '186000000',
    draftPrice: '186000000',
    currencyCode: 'IRR',
    capacityLabel: '۸ صندلی باقی‌مانده',
    ownInventory: true,
    featured: true,
  },
  {
    id: 'preview-tour-kish-001',
    version: 1,
    productType: 'TOUR',
    productName: 'تور کیش ۳ شب',
    serviceCode: 'TOUR-KIH-0312',
    routeLabel: 'تهران ← کیش',
    serviceDate: pricingPreviewDate,
    currentPrice: '248000000',
    draftPrice: '248000000',
    currencyCode: 'IRR',
    capacityLabel: '۵ نفر باقی‌مانده',
    ownInventory: true,
    featured: false,
  },
  {
    id: 'preview-ticket-mhd-001',
    version: 1,
    productType: 'OWN_TICKET',
    productName: 'پرواز مشهد',
    serviceCode: 'NS-MHD-118',
    routeLabel: 'تهران ← مشهد',
    serviceDate: pricingPreviewDate,
    currentPrice: '69500000',
    draftPrice: '69500000',
    currencyCode: 'IRR',
    capacityLabel: '۱۵ صندلی باقی‌مانده',
    ownInventory: true,
    featured: false,
  },
];

const decimalPattern = /^(0|[1-9]\d{0,14})(\.\d{1,2})?$/;

export function validateDailyPrice(item: DailyPriceItem): string | null {
  if (!item.ownInventory)
    return 'فقط تورها و بلیت‌های متعلق به شرکت قابل قیمت‌گذاری هستند.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.serviceDate))
    return 'تاریخ خدمت معتبر نیست.';
  if (!decimalPattern.test(item.draftPrice) || Number(item.draftPrice) <= 0)
    return 'قیمت باید یک مبلغ مثبت و معتبر باشد.';
  if (item.currencyCode === 'IRR' && item.draftPrice.includes('.'))
    return 'مبلغ ریالی نباید اعشار داشته باشد.';
  if (!Number.isSafeInteger(item.version) || item.version < 1)
    return 'نسخه قیمت معتبر نیست.';
  return null;
}

export function priceChanged(item: DailyPriceItem) {
  return item.currentPrice !== item.draftPrice;
}

export function applyPreviewPrices(
  items: readonly DailyPriceItem[],
): DailyPriceItem[] {
  const error = items.map(validateDailyPrice).find(Boolean);
  if (error) throw new Error(error);
  return items.map((item) =>
    priceChanged(item)
      ? { ...item, currentPrice: item.draftPrice, version: item.version + 1 }
      : item,
  );
}

export function filterDailyPrices(
  items: readonly DailyPriceItem[],
  query: string,
  type: PriceProductType | 'ALL',
  date: string,
) {
  const normalized = query.trim().toLocaleLowerCase('fa-IR');
  return items.filter(
    (item) =>
      item.serviceDate === date &&
      (type === 'ALL' || item.productType === type) &&
      (!normalized ||
        `${item.productName} ${item.serviceCode} ${item.routeLabel}`
          .toLocaleLowerCase('fa-IR')
          .includes(normalized)),
  );
}

export function bannerItems(items: readonly DailyPriceItem[]) {
  return items.filter((item) => item.featured).slice(0, 6);
}
