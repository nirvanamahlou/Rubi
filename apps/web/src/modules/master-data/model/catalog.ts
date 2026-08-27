export const masterDataResourceKeys = [
  'countries',
  'regions',
  'cities',
  'airports',
  'terminals',
  'currencies',
  'exchange-rates',
  'banks',
  'insurers',
  'airlines',
  'hotels',
  'organizations',
  'brokers',
  'leaders',
  'acquaintance-methods',
] as const;

export type MasterDataResourceKey = (typeof masterDataResourceKeys)[number];
export type MasterDataFieldType =
  'text' | 'number' | 'datetime-local' | 'select';

export interface MasterDataFieldDefinition {
  key: string;
  label: string;
  type: MasterDataFieldType;
  placeholder: string;
  required?: boolean;
  hint?: string;
  options?: readonly { value: string; label: string }[];
}

export interface MasterDataCatalogItem {
  key: MasterDataResourceKey;
  label: string;
  singularLabel: string;
  group: 'جغرافیا' | 'مالی' | 'خدمات سفر' | 'سازمان‌ها' | 'فروش';
  description: string;
  fields: readonly MasterDataFieldDefinition[];
  preview: Readonly<Record<string, string>>;
}

const nameField: MasterDataFieldDefinition = {
  key: 'name',
  label: 'عنوان فارسی',
  type: 'text',
  placeholder: 'عنوان را وارد کنید',
  required: true,
};

export const masterDataCatalog: readonly MasterDataCatalogItem[] = [
  {
    key: 'countries',
    label: 'کشورها',
    singularLabel: 'کشور',
    group: 'جغرافیا',
    description: 'کشور مشترک بین شرکت‌ها با کد رسمی ISO-2 و نام فارسی/انگلیسی.',
    fields: [
      {
        key: 'iso2Code',
        label: 'کد ISO-2',
        type: 'text',
        placeholder: 'IR',
        required: true,
        hint: 'دو حرف رسمی کشور؛ با حروف بزرگ ذخیره می‌شود.',
      },
      nameField,
      {
        key: 'englishName',
        label: 'عنوان انگلیسی',
        type: 'text',
        placeholder: 'Iran',
        required: true,
      },
    ],
    preview: { iso2Code: 'IR', name: 'ایران', englishName: 'Iran' },
  },
  {
    key: 'regions',
    label: 'استان‌ها و نواحی',
    singularLabel: 'استان/ناحیه',
    group: 'جغرافیا',
    description: 'ساختار سلسله‌مراتبی استان، ایالت و ناحیه در محدوده یک کشور.',
    fields: [
      nameField,
      {
        key: 'englishName',
        label: 'عنوان انگلیسی',
        type: 'text',
        placeholder: 'Tehran Province',
        required: true,
      },
      {
        key: 'countryId',
        label: 'کشور',
        type: 'text',
        placeholder: '',
        required: true,
      },
      {
        key: 'parentRegionId',
        label: 'ناحیه والد',
        type: 'text',
        placeholder: '',
      },
      {
        key: 'type',
        label: 'نوع ساختار',
        type: 'select',
        placeholder: '',
        required: true,
        options: [
          { value: 'PROVINCE', label: 'استان' },
          { value: 'STATE', label: 'ایالت' },
          { value: 'REGION', label: 'ناحیه' },
          { value: 'TERRITORY', label: 'قلمرو' },
        ],
      },
    ],
    preview: { name: 'تهران', englishName: 'Tehran', type: 'PROVINCE' },
  },
  {
    key: 'cities',
    label: 'شهرها',
    singularLabel: 'شهر',
    group: 'جغرافیا',
    description: 'شهر وابسته به کشور و در صورت نیاز استان/ناحیه ساختاری.',
    fields: [
      nameField,
      {
        key: 'englishName',
        label: 'عنوان انگلیسی',
        type: 'text',
        placeholder: 'Tehran',
        required: true,
      },
      {
        key: 'countryId',
        label: 'کشور',
        type: 'text',
        placeholder: '',
        required: true,
      },
      {
        key: 'regionId',
        label: 'استان/ناحیه',
        type: 'text',
        placeholder: '',
      },
    ],
    preview: { name: 'تهران', englishName: 'Tehran', countryId: 'country_ir' },
  },
  {
    key: 'airports',
    label: 'فرودگاه‌ها',
    singularLabel: 'فرودگاه',
    group: 'جغرافیا',
    description:
      'فرودگاه با کدهای رسمی، Timezone معتبر IANA و مختصات کنترل‌شده.',
    fields: [
      nameField,
      {
        key: 'englishName',
        label: 'عنوان انگلیسی',
        type: 'text',
        placeholder: 'Mehrabad International Airport',
        required: true,
      },
      {
        key: 'countryId',
        label: 'کشور',
        type: 'text',
        placeholder: '',
        required: true,
      },
      {
        key: 'cityId',
        label: 'شهر',
        type: 'text',
        placeholder: '',
        required: true,
      },
      {
        key: 'iataCode',
        label: 'کد IATA',
        type: 'text',
        placeholder: 'THR',
        required: true,
      },
      {
        key: 'icaoCode',
        label: 'کد ICAO',
        type: 'text',
        placeholder: 'OIII',
        required: true,
      },
      {
        key: 'ianaTimezone',
        label: 'Timezone IANA',
        type: 'text',
        placeholder: 'Asia/Tehran',
        required: true,
      },
      {
        key: 'latitude',
        label: 'عرض جغرافیایی',
        type: 'number',
        placeholder: '35.6892',
        required: true,
      },
      {
        key: 'longitude',
        label: 'طول جغرافیایی',
        type: 'number',
        placeholder: '51.3134',
        required: true,
      },
    ],
    preview: { iataCode: 'THR', icaoCode: 'OIII', ianaTimezone: 'Asia/Tehran' },
  },
  {
    key: 'terminals',
    label: 'ترمینال‌ها',
    singularLabel: 'ترمینال',
    group: 'جغرافیا',
    description: 'ترمینال وابسته به فرودگاه با نوع داخلی، بین‌المللی یا VIP.',
    fields: [
      nameField,
      {
        key: 'englishName',
        label: 'عنوان انگلیسی',
        type: 'text',
        placeholder: 'Terminal 1',
      },
      {
        key: 'airportId',
        label: 'فرودگاه',
        type: 'text',
        placeholder: '',
        required: true,
      },
      {
        key: 'terminalType',
        label: 'نوع ترمینال',
        type: 'select',
        placeholder: '',
        required: true,
        options: [
          { value: 'DOMESTIC', label: 'داخلی' },
          { value: 'INTERNATIONAL', label: 'بین‌المللی' },
          { value: 'VIP', label: 'VIP' },
        ],
      },
    ],
    preview: {
      name: 'ترمینال ۱',
      airportId: 'airport_thr',
      terminalType: 'DOMESTIC',
    },
  },
  {
    key: 'currencies',
    label: 'ارزها',
    singularLabel: 'ارز',
    group: 'مالی',
    description:
      'مشخصات نمایشی ارز؛ کد داخلی هنگام ذخیره خودکار تولید می‌شود و precision نهایی نیازمند تصمیم مالی است.',
    fields: [
      nameField,
      {
        key: 'englishName',
        label: 'نام انگلیسی',
        type: 'text',
        placeholder: 'Iranian Rial',
      },
      { key: 'symbol', label: 'نماد نمایشی', type: 'text', placeholder: '﷼' },
      {
        key: 'decimalDigits',
        label: 'تعداد رقم اعشار',
        type: 'number',
        placeholder: '2',
      },
    ],
    preview: { code: 'IRR', name: 'ریال ایران', symbol: '﷼' },
  },
  {
    key: 'exchange-rates',
    label: 'نرخ ارز',
    singularLabel: 'نرخ ارز',
    group: 'مالی',
    description:
      'طرح Contract برای snapshot نرخ؛ محاسبه authoritative با DEC-OPEN-004 مسدود است.',
    fields: [
      {
        key: 'fromCurrencyCode',
        label: 'ارز مبدأ',
        type: 'text',
        placeholder: 'USD',
        required: true,
      },
      {
        key: 'toCurrencyCode',
        label: 'ارز مقصد',
        type: 'text',
        placeholder: 'IRR',
        required: true,
      },
      {
        key: 'rate',
        label: 'نرخ Decimal',
        type: 'number',
        placeholder: '0.00',
        required: true,
      },
      {
        key: 'rateType',
        label: 'نوع نرخ',
        type: 'text',
        placeholder: 'BUY / SELL / REFERENCE',
        required: true,
      },
      {
        key: 'source',
        label: 'منبع نرخ',
        type: 'text',
        placeholder: 'منبع تأییدشده',
        required: true,
      },
      {
        key: 'observedAt',
        label: 'زمان مشاهده UTC',
        type: 'datetime-local',
        placeholder: '',
        required: true,
      },
      {
        key: 'validFrom',
        label: 'شروع اعتبار UTC',
        type: 'datetime-local',
        placeholder: '',
        required: true,
      },
      {
        key: 'validTo',
        label: 'پایان اعتبار (اختیاری)',
        type: 'datetime-local',
        placeholder: '',
      },
      {
        key: 'correctionReason',
        label: 'توضیح اصلاح',
        type: 'text',
        placeholder: 'در صورت اصلاح نسخه قبلی',
      },
    ],
    preview: {
      fromCurrencyCode: 'USD',
      toCurrencyCode: 'IRR',
      rate: '—',
      source: 'Blocked',
    },
  },
  {
    key: 'banks',
    label: 'بانک‌ها',
    singularLabel: 'بانک',
    group: 'مالی',
    description: 'تعریف بانک و کشور مرجع؛ حساب و مانده متعلق به Finance است.',
    fields: [
      nameField,
      {
        key: 'countryId',
        label: 'کشور',
        type: 'text',
        placeholder: 'country_...',
        required: true,
      },
    ],
    preview: {
      code: 'BANK_SAMPLE',
      name: 'بانک نمونه',
      countryId: 'country_ir',
    },
  },
  {
    key: 'insurers',
    label: 'بیمه‌ها',
    singularLabel: 'بیمه‌گر',
    group: 'خدمات سفر',
    description:
      'سازمان بیمه‌گر و reference خدمت؛ قرارداد خرید در Procurement است.',
    fields: [
      nameField,
      {
        key: 'organizationId',
        label: 'سازمان بیمه‌گر',
        type: 'text',
        placeholder: 'org_...',
        required: true,
      },
    ],
    preview: {
      code: 'INS_SAMPLE',
      name: 'بیمه نمونه',
      organizationId: 'org_insurer',
    },
  },
  {
    key: 'airlines',
    label: 'ایرلاین‌ها',
    singularLabel: 'ایرلاین',
    group: 'خدمات سفر',
    description:
      'مشخصات ایرلاین، کد تخصصی ICAO و پیوند Organization بدون اطلاعات اتصال Provider؛ کد داخلی خودکار است.',
    fields: [
      nameField,
      { key: 'icaoCode', label: 'کد ICAO', type: 'text', placeholder: 'IRM' },
      {
        key: 'organizationId',
        label: 'سازمان ایرلاین',
        type: 'text',
        placeholder: 'org_...',
        required: true,
      },
    ],
    preview: {
      code: 'W5',
      name: 'ایرلاین نمونه',
      icaoCode: 'IRM',
      organizationId: 'org_airline',
    },
  },
  {
    key: 'hotels',
    label: 'هتل‌ها',
    singularLabel: 'هتل',
    group: 'خدمات سفر',
    description:
      'هتل، شهر و درجه‌بندی نمایشی؛ قرارداد و نرخ خرید خارج از Master Data است.',
    fields: [
      nameField,
      {
        key: 'cityId',
        label: 'شهر',
        type: 'text',
        placeholder: 'city_...',
        required: true,
      },
      {
        key: 'starRating',
        label: 'درجه هتل',
        type: 'number',
        placeholder: '1 تا 5',
      },
    ],
    preview: {
      code: 'HTL_SAMPLE',
      name: 'هتل نمونه',
      cityId: 'city_tehran',
      starRating: '5',
    },
  },
  {
    key: 'organizations',
    label: 'آژانس‌ها و شرکت‌ها',
    singularLabel: 'سازمان',
    group: 'سازمان‌ها',
    description:
      'Profile مشترک Organization با roleهای چندگانه Agency/Corporate.',
    fields: [
      {
        key: 'legalName',
        label: 'نام ثبتی',
        type: 'text',
        placeholder: 'نام ثبتی',
        required: true,
      },
      {
        key: 'displayName',
        label: 'نام نمایشی',
        type: 'text',
        placeholder: 'نام نمایشی',
        required: true,
      },
      {
        key: 'roleCodes',
        label: 'Roleهای سازمان',
        type: 'text',
        placeholder: 'AGENCY,CORPORATE_CUSTOMER',
        required: true,
      },
    ],
    preview: {
      code: 'ORG_SAMPLE',
      legalName: 'شرکت نمونه',
      displayName: 'سازمان نمونه',
      roleCodes: 'AGENCY',
    },
  },
  {
    key: 'brokers',
    label: 'کارگزاران',
    singularLabel: 'کارگزار',
    group: 'سازمان‌ها',
    description:
      'Profile عملیاتی کارگزار با reference سازمان؛ بدهی و قرارداد اینجا نگهداری نمی‌شود.',
    fields: [
      nameField,
      {
        key: 'organizationId',
        label: 'سازمان کارگزار',
        type: 'text',
        placeholder: 'org_...',
        required: true,
      },
    ],
    preview: {
      code: 'BROKER_SAMPLE',
      name: 'کارگزار نمونه',
      organizationId: 'org_broker',
    },
  },
  {
    key: 'leaders',
    label: 'لیدرها',
    singularLabel: 'لیدر',
    group: 'خدمات سفر',
    description:
      'اطلاعات مرجع لیدر؛ سند، حساب بانکی و دستمزد با permission و ماژول مالک نگهداری می‌شود.',
    fields: [
      nameField,
      {
        key: 'languages',
        label: 'زبان‌ها',
        type: 'text',
        placeholder: 'fa,en',
        required: true,
      },
      {
        key: 'expertise',
        label: 'تخصص/مقصد',
        type: 'text',
        placeholder: 'تور داخلی',
      },
    ],
    preview: {
      code: 'LEADER_SAMPLE',
      name: 'لیدر نمونه',
      languages: 'fa,en',
      expertise: 'تور داخلی',
    },
  },
  {
    key: 'acquaintance-methods',
    label: 'نحوه آشنایی',
    singularLabel: 'نحوه آشنایی',
    group: 'فروش',
    description:
      'Reference مستقل از Sales Channel و Campaign برای منشأ آشنایی مشتری.',
    fields: [
      nameField,
      {
        key: 'description',
        label: 'توضیح',
        type: 'text',
        placeholder: 'توضیح اختیاری',
      },
    ],
    preview: {
      code: 'REFERRAL',
      name: 'معرفی دوستان',
      description: 'نمونه طراحی',
    },
  },
];

export function getMasterDataDefinition(resource: MasterDataResourceKey) {
  const definition = masterDataCatalog.find((item) => item.key === resource);
  if (!definition) throw new Error(`Unknown master data resource: ${resource}`);
  return definition;
}
