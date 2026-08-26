export const masterDataResourceKeys = [
  'countries',
  'cities',
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
export type MasterDataFieldType = 'text' | 'number' | 'datetime-local';

export interface MasterDataFieldDefinition {
  key: string;
  label: string;
  type: MasterDataFieldType;
  placeholder: string;
  required?: boolean;
  hint?: string;
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
    description:
      'کشور با نام فارسی و انگلیسی؛ کد داخلی هنگام ذخیره خودکار تولید می‌شود.',
    fields: [
      nameField,
      {
        key: 'englishName',
        label: 'عنوان انگلیسی',
        type: 'text',
        placeholder: 'Iran',
        required: true,
      },
    ],
    preview: { code: 'IR', name: 'ایران', englishName: 'Iran' },
  },
  {
    key: 'cities',
    label: 'شهرها',
    singularLabel: 'شهر',
    group: 'جغرافیا',
    description: 'شهر وابسته به کشور؛ حذف رکورد استفاده‌شده مجاز نیست.',
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
    preview: { code: 'THR', name: 'تهران', countryId: 'country_ir' },
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
        key: 'organizationId',
        label: 'سازمان هتل (اختیاری)',
        type: 'text',
        placeholder: '',
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
