import type { MasterDataResource } from './index';

export interface MasterDataColumnFilter {
  readonly label: string;
  readonly path: readonly string[];
  readonly kind?: 'number' | 'boolean' | 'enum';
  readonly options?: readonly (readonly [string, string])[];
}
const field = (label: string, ...path: string[]): MasterDataColumnFilter => ({
  label,
  path,
});
const code = field('کد', 'code');
const english = field('نام انگلیسی', 'englishName');
const country = field('کشور', 'country', 'name');
const manufacturer = field('سازنده', 'manufacturer');
const category = field('دسته', 'category');
const boolean = (label: string, path: string): MasterDataColumnFilter => ({
  label,
  path: [path],
  kind: 'boolean',
  options: [
    ['true', 'بله'],
    ['false', 'خیر'],
  ],
});
const enumField = (
  label: string,
  path: string,
  options: readonly (readonly [string, string])[],
): MasterDataColumnFilter => ({ label, path: [path], kind: 'enum', options });

/** Two fixed, allowlisted column filters per catalog; no caller-defined database fields. */
export function getMasterDataColumnFilters(
  resource: MasterDataResource,
): readonly [MasterDataColumnFilter, MasterDataColumnFilter] {
  switch (resource) {
    case 'countries':
      return [code, english];
    case 'regions':
      return [
        english,
        enumField('نوع ساختار', 'type', [
          ['PROVINCE', 'استان'],
          ['STATE', 'ایالت'],
          ['REGION', 'ناحیه'],
          ['TERRITORY', 'قلمرو'],
        ]),
      ];
    case 'cities':
      return [english, field('استان/ناحیه', 'region', 'name')];
    case 'airports':
      return [field('IATA', 'iataCode'), field('ICAO', 'icaoCode')];
    case 'terminals':
      return [
        field('نام فرودگاه', 'airport', 'name'),
        enumField('ساعت فعالیت', 'operatingHoursMode', [
          ['ALL_DAY', 'شبانه‌روزی'],
          ['TIME_RANGE', 'بازه مشخص'],
        ]),
      ];
    case 'currencies':
      return [code, english];
    case 'exchange-rates':
      return [
        field('ارز مبدأ', 'fromCurrency', 'code'),
        field('ارز مقصد', 'toCurrency', 'code'),
      ];
    case 'banks':
      return [country, field('SWIFT', 'swiftCode')];
    case 'bank-branches':
      return [field('بانک', 'bank', 'name'), field('شهر', 'city', 'name')];
    case 'payment-methods':
      return [
        enumField('کانال', 'channel', [
          ['CASH', 'نقدی'],
          ['POS', 'کارت‌خوان'],
          ['BANK_TRANSFER', 'حواله بانکی'],
          ['ONLINE_GATEWAY', 'درگاه آنلاین'],
          ['CREDIT', 'اعتباری'],
          ['WALLET', 'کیف پول'],
          ['OTHER', 'سایر'],
        ]),
        enumField('جهت', 'direction', [
          ['RECEIPT', 'دریافت'],
          ['PAYMENT', 'پرداخت'],
          ['BOTH', 'هر دو'],
        ]),
      ];
    case 'organizations':
      return [
        field('نام حقوقی', 'legalName'),
        enumField('نوع شخصیت', 'personType', [
          ['NATURAL', 'حقیقی'],
          ['LEGAL', 'حقوقی'],
        ]),
      ];
    case 'suppliers':
    case 'brokers':
      return [country, field('خدمت', 'services', 'some', 'service', 'name')];
    case 'organization-contacts':
      return [
        field('نام مخاطب', 'fullName'),
        field('سازمان', 'organization', 'displayName'),
      ];
    case 'hotels':
      return [
        field('زنجیره', 'chain', 'name'),
        boolean('فروش‌پذیری', 'isSaleableReference'),
      ];
    case 'hotel-chains':
      return [english, field('وب‌سایت', 'website')];
    case 'room-types':
      return [english, field('توضیح استفاده', 'usageDescription')];
    case 'meal-services':
      return [code, english];
    case 'facilities':
      return [english, category];
    case 'composite-hotels':
      return [
        field('شهر', 'city', 'name'),
        boolean('فروش‌پذیری', 'isSaleableReference'),
      ];
    case 'airlines':
    case 'rail-companies':
    case 'bus-companies':
      return [country, field('سازمان', 'organization', 'displayName')];
    case 'aircraft-types':
      return [
        manufacturer,
        enumField('نوع بدنه', 'bodyType', [
          ['NARROW_BODY', 'باریک‌پیکر'],
          ['WIDE_BODY', 'پهن‌پیکر'],
          ['TURBOPROP', 'توربوپراپ'],
          ['REGIONAL', 'منطقه‌ای'],
          ['OTHER', 'سایر'],
        ]),
      ];
    case 'cabin-classes':
      return [
        english,
        enumField('Cabin', 'cabinType', [
          ['ECONOMY', 'اقتصادی'],
          ['PREMIUM_ECONOMY', 'اقتصادی ممتاز'],
          ['BUSINESS', 'تجاری'],
          ['FIRST', 'فرست کلاس'],
        ]),
      ];
    case 'baggage-rules':
      return [
        field('ایرلاین', 'airline', 'name'),
        enumField('نوع مسافر', 'passengerType', [
          ['ADT', 'بزرگسال'],
          ['CHD', 'کودک'],
          ['INF', 'نوزاد'],
        ]),
      ];
    case 'manifest-templates':
      return [
        field('ایرلاین', 'airline', 'name'),
        enumField('فرمت فایل', 'fileFormat', [
          ['XLSX', 'XLSX'],
          ['CSV', 'CSV'],
          ['XML', 'XML'],
          ['JSON', 'JSON'],
        ]),
      ];
    case 'train-types':
      return [
        manufacturer,
        enumField('نوع', 'category', [
          ['SLEEPER', 'خواب'],
          ['EXPRESS', 'سریع‌السیر'],
          ['SALOON', 'سالنی'],
          ['LUXURY', 'لوکس'],
          ['OTHER', 'سایر'],
        ]),
      ];
    case 'bus-types':
      return [
        manufacturer,
        enumField('کلاس خدمات', 'serviceClass', [
          ['STANDARD', 'استاندارد'],
          ['VIP', 'VIP'],
          ['LUXURY', 'لوکس'],
          ['OTHER', 'سایر'],
        ]),
      ];
    case 'insurers':
      return [country, english];
    case 'insurance-plans':
      return [
        field('بیمه‌گر', 'insurer', 'name'),
        field('منطقه مقصد', 'destinationRegion'),
      ];
    case 'insurance-coverages':
      return [field('ارز', 'currency', 'code'), english];
    case 'leaders':
      return [english, field('شهر', 'city', 'name')];
    case 'tour-types':
      return [
        english,
        enumField('دامنه', 'scope', [
          ['DOMESTIC', 'داخلی'],
          ['INTERNATIONAL', 'خارجی'],
          ['BOTH', 'هر دو'],
        ]),
      ];
    case 'transfer-types':
      return [
        field('وسیله', 'vehicleType'),
        enumField('شیوه سرویس', 'serviceMode', [
          ['PRIVATE', 'اختصاصی'],
          ['SHARED', 'اشتراکی'],
        ]),
      ];
    case 'visa-services':
      return [country, field('نوع ویزا', 'visaType')];
    case 'cip-services':
      return [field('فرودگاه', 'airport', 'name'), english];
    default:
      return [code, english];
  }
}
