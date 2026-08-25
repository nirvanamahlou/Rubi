export type FoundationModuleKey =
  | 'reservations'
  | 'ticket-management'
  | 'sales'
  | 'purchases'
  | 'marketing'
  | 'organizations'
  | 'human-resources'
  | 'tasks'
  | 'documents'
  | 'reports'
  | 'integrations'
  | 'system';

export interface FoundationSection {
  title: string;
  description: string;
  items: readonly string[];
}

export interface FoundationMetric {
  label: string;
  value: string;
  detail: string;
}

export interface FoundationReference {
  label: string;
  owner: string;
  contract: string;
}

export interface FoundationRow {
  id: string;
  title: string;
  flow: string;
  status: 'منتظر اقدام' | 'در حال بررسی' | 'نیازمند تأیید' | 'آماده';
  owner: string;
  updatedAt: string;
}

export interface FoundationModuleConfig {
  key: FoundationModuleKey;
  title: string;
  description: string;
  boundary: string;
  createLabel: string;
  sections: readonly FoundationSection[];
  metrics: readonly FoundationMetric[];
  permissions: readonly string[];
  references: readonly FoundationReference[];
  rows: readonly FoundationRow[];
  outputFormats: readonly string[];
}

const sampleRows = (prefix: string): readonly FoundationRow[] => [
  {
    id: 'PREVIEW-001',
    title: `${prefix} نمونه ۱۴۰۵-۰۰۱`,
    flow: 'صف بررسی طراحی',
    status: 'منتظر اقدام',
    owner: 'کارشناس نمونه',
    updatedAt: 'امروز، ۰۹:۳۰',
  },
  {
    id: 'PREVIEW-002',
    title: `${prefix} نمونه ۱۴۰۵-۰۰۲`,
    flow: 'کنترل اطلاعات',
    status: 'در حال بررسی',
    owner: 'تیم نمونه',
    updatedAt: 'دیروز، ۱۵:۱۰',
  },
  {
    id: 'PREVIEW-003',
    title: `${prefix} نمونه ۱۴۰۵-۰۰۳`,
    flow: 'تأیید داخلی',
    status: 'نیازمند تأیید',
    owner: 'ناظر نمونه',
    updatedAt: '۲ روز پیش',
  },
  {
    id: 'PREVIEW-004',
    title: `${prefix} نمونه ۱۴۰۵-۰۰۴`,
    flow: 'آماده تحویل',
    status: 'آماده',
    owner: 'واحد نمونه',
    updatedAt: '۳ روز پیش',
  },
];

const metrics = (labels: readonly string[]): readonly FoundationMetric[] =>
  labels.map((label, index) => ({
    label,
    value: '—',
    detail:
      index === 0
        ? 'پس از اتصال Backend'
        : index === 1
          ? 'بدون داده ذخیره‌شده'
          : 'نمای طراحی',
  }));

export const foundationModules: Record<
  FoundationModuleKey,
  FoundationModuleConfig
> = {
  reservations: {
    key: 'reservations',
    title: 'رزرواسیون و عملیات سفر',
    description:
      'مرکز استعلام، Hold، اجرای snapshot تأییدشده فروش، صدور خدمات و عملیات سفر.',
    boundary:
      'رزرواسیون تخصیص مشتری، مسافر یا خدمت را تغییر نمی‌دهد؛ نقص ورودی با درخواست اصلاح به فروش بازمی‌گردد.',
    createLabel: 'درخواست استعلام',
    metrics: metrics([
      'استعلام‌های منتظر',
      'Hold نزدیک انقضا',
      'صدورهای در انتظار',
      'Manifest آماده بازبینی',
    ]),
    sections: [
      {
        title: 'استعلام و Hold',
        description: 'بررسی قبل از قرارداد',
        items: [
          'صف استعلام فروش و بررسی ظرفیت بلیت، هتل و تور',
          'استعلام API و کارگزار، قیمت خرید و شرایط کنسلی',
          'پیشنهاد جایگزین، مهلت اعتبار و Hold ظرفیت',
        ],
      },
      {
        title: 'صف اجرای قرارداد',
        description: 'Snapshot فقط‌خواندنی فروش',
        items: [
          'قرارداد، مشتری، پرداخت‌کننده و مسافران فقط‌خواندنی',
          'خدمت، بلیت، هتل، اتاق، بیمه و خدمات جانبی تخصیص‌یافته',
          'درخواست اصلاح اطلاعات ناقص یا اشتباه برای فروش',
        ],
      },
      {
        title: 'صدور و تغییر بلیت',
        description: 'عملیات مسافر در رزرواسیون',
        items: [
          'صدور دستی، Provider، API یا تأییدیه ظرفیت شرکت',
          'PNR، شماره رسمی بلیت، Reissue، Void و تغییر تاریخ',
          'کنسلی، استرداد و کنترل عدم صدور تکراری',
        ],
      },
      {
        title: 'Manifest',
        description: 'قالب و نسخه ایرلاین',
        items: [
          'بزرگسال، کودک و نوزاد هر پرواز',
          'قالب Excel ایرلاین، بازبینی، ارسال و ثبت پاسخ',
          'نسخه اصلاحی و الحاقی، حذف/اصلاح کنترل‌شده و Audit',
        ],
      },
      {
        title: 'هتل و واچر',
        description: 'هماهنگی کارگزار',
        items: [
          'فرم رزرو، Check-in/out، اتاق، تخت، غذا، ترانسفر و لیدر',
          'محل ملاقات، متن تابلو، پاسخ و Confirmation Number',
          'صدور، نسخه‌بندی، اصلاح و لغو واچر پس از تأیید',
        ],
      },
      {
        title: 'بیمه و خرید',
        description: 'Saman و Procurement port',
        items: [
          'صدور/ابطال/استرداد idempotent بیمه سامان',
          'درخواست خرید متصل به قرارداد، خدمت، مسافر و عملیات',
          'کارگزار، قیمت اولیه، تخفیف، ارز، مهلت و مدرک تأیید',
        ],
      },
    ],
    permissions: [
      'reservation.read',
      'reservation.inquiry.create',
      'reservation.hold.manage',
      'reservation.issue',
      'reservation.cancel',
      'reservation.manifest.manage',
    ],
    references: [
      {
        label: 'Snapshot قرارداد',
        owner: 'Sales Contracts',
        contract: 'sales.execution-snapshot.v1 (پیشنهادی)',
      },
      {
        label: 'درخواست خرید',
        owner: 'Procurement',
        contract: 'procurement.purchase-request.v1 (پیشنهادی)',
      },
      {
        label: 'نتیجه Provider',
        owner: 'Integrations',
        contract: 'integrations.normalized-result.v1 (پیشنهادی)',
      },
    ],
    rows: sampleRows('پرونده اجرایی'),
    outputFormats: ['خلاصه عملیات PDF', 'صف اقدام Excel', 'Manifest Excel'],
  },
  'ticket-management': {
    key: 'ticket-management',
    title: 'مدیریت و تعریف بلیت‌ها',
    description:
      'تعریف محصول بلیت، برنامه، نرخ و ظرفیت قابل فروش بدون صدور سند برای مسافر.',
    boundary:
      'این ماژول فقط محصول و موجودی قابل فروش را منتشر می‌کند؛ صدور مسافر، PNR و Manifest متعلق به رزرواسیون است.',
    createLabel: 'تعریف بلیت',
    metrics: metrics([
      'برنامه‌های فعال',
      'ظرفیت قابل فروش',
      'Hold جاری',
      'پروازهای متوقف',
    ]),
    sections: [
      {
        title: 'مشخصات پرواز',
        description: 'محصول قابل فروش',
        items: [
          'ایرلاین، شماره پرواز، مبدأ، مقصد، فرودگاه و ترمینال',
          'زمان حرکت و رسیدن، کلاس پروازی و بار مجاز',
          'قوانین تغییر، کنسلی و اطلاع‌رسانی',
        ],
      },
      {
        title: 'نوع تأمین و قیمت',
        description: 'قیمت نسخه‌دار',
        items: [
          'ظرفیت شرکت، چارتر، سهمیه، Provider، API و دستی',
          'قیمت خرید و فروش، ارز، Markup، کمیسیون و تخفیف',
          'بازه اعتبار قیمت و ثبت دلیل تغییر',
        ],
      },
      {
        title: 'ظرفیت و فروش',
        description: 'جلوگیری از Oversell',
        items: [
          'ظرفیت کل، قابل فروش، Hold، قطعی، فروخته و باقی‌مانده',
          'قفل همزمان، جلوگیری از موجودی منفی و توقف فروش',
          'لغو برنامه و اعلان عملیات متأثر',
        ],
      },
      {
        title: 'نسخه و عملیات گروهی',
        description: 'مدیریت انبوه',
        items: [
          'نسخه‌بندی زمان، قیمت، ظرفیت و قوانین با Audit',
          'ورود Excel، پرواز تکرارشونده و کپی برنامه',
          'ویرایش گروهی قیمت/وضعیت و مسیر خروجی ظرفیت',
        ],
      },
    ],
    permissions: [
      'ticket_catalog.read',
      'ticket_catalog.create',
      'ticket_catalog.update',
      'ticket_catalog.inventory.manage',
      'ticket_catalog.bulk_import',
      'ticket_catalog.export',
    ],
    references: [
      {
        label: 'ایرلاین و فرودگاه',
        owner: 'Master Data',
        contract: 'master-data.references.v1',
      },
      {
        label: 'Hold ظرفیت',
        owner: 'Reservations',
        contract: 'reservation.capacity-command.v1 (پیشنهادی)',
      },
      {
        label: 'قواعد قیمت',
        owner: 'Settings',
        contract: 'settings.effective-pricing.v1 (پیشنهادی)',
      },
    ],
    rows: sampleRows('برنامه بلیت'),
    outputFormats: ['ظرفیت Excel', 'برنامه پرواز CSV'],
  },
  sales: {
    key: 'sales',
    title: 'قراردادها، فروش و تخصیص خدمات',
    description:
      'مالک پرونده فروش، پیشنهاد، قرارداد و اتصال هر مسافر به خدمات سفر.',
    boundary:
      'فقط فروش مشتری، پرداخت‌کننده و مسافران را به قرارداد و service item متصل می‌کند؛ اجرای واقعی در رزرواسیون است.',
    createLabel: 'فروش جدید',
    metrics: metrics([
      'پرونده‌های جدید',
      'پیشنهادهای معتبر',
      'قراردادهای منتظر مدیر',
      'مدارک آماده تحویل',
    ]),
    sections: [
      {
        title: 'فروش جدید',
        description: 'دریافت درخواست واجد شرایط',
        items: [
          'انتخاب یا ایجاد مشتری و انتخاب پرداخت‌کننده',
          'انتخاب مسافران، مدارک ورودی، شعبه و کارشناس',
          'تحویل کنترل‌شده از Customer Affairs',
        ],
      },
      {
        title: 'تخصیص خدمات',
        description: 'Passenger service allocation',
        items: [
          'بلیت، هتل، اتاق، بیمه، تور و اتوبوس هر مسافر',
          'ویزا، ترانسفر، CIP و خدمات دستی/جانبی',
          'جست‌وجوی محصول، مشاهده ظرفیت/قیمت/قانون و درخواست Hold',
        ],
      },
      {
        title: 'پیشنهاد قیمت',
        description: 'Quotation نسخه‌دار',
        items: [
          'اقلام، تعداد، قیمت خرید/فروش، Markup و تخفیف',
          'ارز، مالیات، کارمزد، اعتبار و نسخه‌های پیشنهاد',
          'ثبت دلیل تغییر بدون بازنویسی نسخه قبلی',
        ],
      },
      {
        title: 'قرارداد و مدارک',
        description: 'شرایط و پیوست‌ها',
        items: [
          'شماره، طرف‌ها، خدمات، مبلغ، پرداخت، کنسلی و تعهدات',
          'مدارک هویتی، پیشنهاد، قرارداد، الحاقیه و فایل امضاشده',
          'پیش‌نویس تا فعال/تکمیل/لغو با history',
        ],
      },
      {
        title: 'تحویل بین واحدها',
        description: 'Finance + Reservations',
        items: [
          'انتشار snapshot ثابت برای پرونده مالی و اجرایی',
          'مشاهده execution و Financial Release بدون تغییر مالکیت',
          'تحویل مدارک آزادشده به فروش و ثبت ارسال برای مسافر',
        ],
      },
    ],
    permissions: [
      'sales.read',
      'sales.create',
      'sales.quote.manage',
      'sales.contract.approve',
      'sales.allocation.manage',
      'sales.document.deliver',
    ],
    references: [
      {
        label: 'مشتری و مسافر',
        owner: 'Customers',
        contract: 'customers.v2',
      },
      {
        label: 'بلیت قابل فروش',
        owner: 'Ticket Catalog',
        contract: 'ticket-catalog.sellable-search.v1 (پیشنهادی)',
      },
      {
        label: 'مجوز تحویل',
        owner: 'Finance',
        contract: 'finance.financial-release.v1-proposal',
      },
    ],
    rows: sampleRows('قرارداد فروش'),
    outputFormats: ['پیشنهاد PDF', 'قرارداد PDF', 'Pipeline Excel'],
  },
  purchases: {
    key: 'purchases',
    title: 'خرید و تأمین',
    description:
      'مالک درخواست، سفارش و فاکتور خرید، تخفیف کارگزار و قیمت خالص نسخه‌دار.',
    boundary:
      'درخواست سفر از رزرواسیون می‌آید؛ Procurement وضعیت خرید و payable source را مالک است و سود فیلد دستی نیست.',
    createLabel: 'ثبت خرید عمومی',
    metrics: metrics([
      'درخواست‌های جدید',
      'منتظر تأیید',
      'بدهی کارگزار',
      'تغییر قیمت باز',
    ]),
    sections: [
      {
        title: 'درخواست خرید سفر',
        description: 'Referenceهای واقعی آینده',
        items: [
          'قرارداد، service item، مسافر و عملیات رزرواسیون',
          'کارگزار/تأمین‌کننده، کارشناس و مدرک تأیید',
          'قیمت اولیه، ارز، نرخ تبدیل و مهلت پرداخت',
        ],
      },
      {
        title: 'قیمت خالص و تخفیف',
        description: 'محاسبه معتبر سود',
        items: [
          'تخفیف کارگزار، کارمزد، مالیات و هزینه خرید',
          'قیمت خالص = اولیه - تخفیف + fee و هزینه',
          'افزایش خودکار سود با کاهش خرید؛ margin غیرقابل ویرایش',
        ],
      },
      {
        title: 'گردش خرید',
        description: 'PR تا Payable',
        items: [
          'پیش‌نویس، ثبت، تأیید، سفارش، دریافت، لغو و استرداد',
          'Purchase Order، Service Receipt و Purchase Invoice',
          'بدهی، شرایط پرداخت و تسویه کارگزار',
        ],
      },
      {
        title: 'نسخه و استرداد',
        description: 'تاریخچه تغییر قیمت',
        items: [
          'نسخه جدید قیمت، دلیل، actor، UTC و حفظ نسخه قبلی',
          'لغو، استرداد، جریمه و مبلغ قابل دریافت',
          'محاسبه مجدد سود از snapshot فروش و خرید approved',
        ],
      },
    ],
    permissions: [
      'procurement.read',
      'procurement.request.create',
      'procurement.approve',
      'procurement.order.manage',
      'procurement.invoice.manage',
      'procurement.export',
    ],
    references: [
      {
        label: 'درخواست رزرواسیون',
        owner: 'Reservations',
        contract: 'reservation.purchase-requested.v1 (پیشنهادی)',
      },
      {
        label: 'تأمین‌کننده',
        owner: 'Master Data',
        contract: 'master-data.organizations.v1',
      },
      {
        label: 'Payable',
        owner: 'Finance',
        contract: 'finance.payable-source.v1-proposal',
      },
    ],
    rows: sampleRows('درخواست خرید'),
    outputFormats: ['خریدها Excel', 'تسویه کارگزار PDF'],
  },
  marketing: {
    key: 'marketing',
    title: 'مارکتینگ',
    description: 'کمپین، audience رضایت‌محور، پیام، پیشنهاد و سنجش عملکرد جذب.',
    boundary:
      'Consent جاری متعلق به Customers است و پیش از materialize یا ارسال دوباره کنترل می‌شود.',
    createLabel: 'کمپین جدید',
    metrics: metrics([
      'کمپین فعال',
      'بودجه مصرف‌شده',
      'نرخ تبدیل',
      'درآمد منتسب',
    ]),
    sections: [
      {
        title: 'کمپین و بودجه',
        description: 'برنامه جذب',
        items: [
          'نام، هدف، بودجه، بازه زمانی و وضعیت کمپین',
          'UTM، منبع جذب و اتصال کمپین به Lead',
          'هزینه جذب مشتری، درآمد و عملکرد کمپین',
        ],
      },
      {
        title: 'گروه‌بندی مشتری',
        description: 'Audience رضایت‌محور',
        items: [
          'Segmentهای رفتاری و مشخصات سفر بدون PII نمایشی',
          'کنترل رضایت بازاریابی هنگام ساخت و ارسال audience',
          'لغو عضویت فوری از قرارداد عمومی Customers',
        ],
      },
      {
        title: 'پیام و پیشنهاد',
        description: 'کانال‌های ارتباطی',
        items: [
          'پیامک، ایمیل و قالب پیام نسخه‌دار',
          'کد تخفیف و پیشنهاد ویژه با اعتبار و محدودیت',
          'شاخص ارسال، تحویل، بازشدن، کلیک و conversion',
        ],
      },
    ],
    permissions: [
      'marketing.read',
      'marketing.campaign.manage',
      'marketing.segment.manage',
      'marketing.message.send',
      'marketing.discount.manage',
      'marketing.report.read',
    ],
    references: [
      {
        label: 'رضایت مشتری',
        owner: 'Customers',
        contract: 'customers.consent-check.v2',
      },
      {
        label: 'سرنخ',
        owner: 'Customer Affairs',
        contract: 'customer-affairs.lead-reference.v1 (پیشنهادی)',
      },
      {
        label: 'درآمد منتسب',
        owner: 'Reporting',
        contract: 'reporting.campaign-facts.v1 (پیشنهادی)',
      },
    ],
    rows: sampleRows('کمپین'),
    outputFormats: ['عملکرد Excel', 'خلاصه کمپین PDF'],
  },
  organizations: {
    key: 'organizations',
    title: 'آژانس‌ها و مشتریان سازمانی',
    description:
      'پرونده B2B، قرارداد همکاری، نرخ توافقی، اعتبار و تسویه دوره‌ای.',
    boundary:
      'Organization و role در Master Data است؛ این بخش شرایط B2B و اعتبار را مالک است و مانده مالی از Finance می‌آید.',
    createLabel: 'پرونده سازمان',
    metrics: metrics([
      'سازمان‌های فعال',
      'اعتبار درگیر',
      'فاکتور تجمیعی',
      'تسویه نزدیک',
    ]),
    sections: [
      {
        title: 'پرونده و نمایندگان',
        description: 'Agency / Corporate',
        items: [
          'پرونده آژانس یا سازمان و نقش‌های چندگانه',
          'نمایندگان، کاربران سازمان و مدیر حساب',
          'مسافران سازمانی و اسناد قرارداد',
        ],
      },
      {
        title: 'قرارداد همکاری',
        description: 'شرایط تجاری',
        items: [
          'قرارداد چارچوب، نرخ توافقی و دوره اعتبار',
          'تخفیف، پورسانت و policy رزرو',
          'تاریخچه نسخه و تأیید شرایط حساس',
        ],
      },
      {
        title: 'اعتبار و تسویه',
        description: 'Exposure از Finance',
        items: [
          'سقف و مانده اعتبار با وضعیت مجاز/مسدود',
          'قراردادها، سفارش‌ها و فاکتور تجمیعی',
          'دریافت، چک و تسویه دوره‌ای',
        ],
      },
    ],
    permissions: [
      'b2b.read',
      'b2b.profile.manage',
      'b2b.contract.manage',
      'b2b.credit.approve',
      'b2b.rate.manage',
      'b2b.statement.read',
    ],
    references: [
      {
        label: 'Organization',
        owner: 'Master Data',
        contract: 'master-data.organizations.v1',
      },
      {
        label: 'مانده اعتبار',
        owner: 'Finance',
        contract: 'finance.exposure-query.v1-proposal',
      },
      {
        label: 'قرارداد فروش',
        owner: 'Sales Contracts',
        contract: 'sales.contract-reference.v1 (پیشنهادی)',
      },
    ],
    rows: sampleRows('پرونده سازمانی'),
    outputFormats: ['صورت‌حساب PDF', 'سفارش‌ها Excel'],
  },
  'human-resources': {
    key: 'human-resources',
    title: 'منابع انسانی',
    description:
      'پرونده مستقل Employee، ساختار سازمانی، زمان، ارزیابی و ورودی کنترل‌شده مالی.',
    boundary:
      'Employee با Customer یا Passenger ادغام نمی‌شود؛ جزئیات حساس HR به Finance کپی یا از آن query نمی‌شود.',
    createLabel: 'پرونده پرسنلی',
    metrics: metrics([
      'همکاران فعال',
      'قرارداد نزدیک پایان',
      'مرخصی منتظر',
      'مدرک نزدیک انقضا',
    ]),
    sections: [
      {
        title: 'پرونده کارکنان',
        description: 'اطلاعات Masked',
        items: [
          'اطلاعات تماس، اضطراری و بانکی Masked',
          'شعبه، واحد، سمت، مدیر و چارت سازمانی',
          'قرارداد کاری و تاریخچه وضعیت استخدام',
        ],
      },
      {
        title: 'زمان و حضور',
        description: 'گردش تأیید',
        items: [
          'حضور و غیاب، شیفت و تقویم کاری',
          'مرخصی، مأموریت و اضافه‌کاری',
          'منبع رکورد، ناظر و approval history',
        ],
      },
      {
        title: 'توسعه و دارایی',
        description: 'چرخه حرفه‌ای',
        items: [
          'ارزیابی عملکرد، آموزش و گواهینامه',
          'تجهیزات تحویلی و مدارک پرسنلی',
          'هشدار پایان قرارداد، گواهی و مدرک',
        ],
      },
      {
        title: 'امنیت و مالی',
        description: 'حداقل داده لازم',
        items: [
          'Permission جدا برای مشاهده، تغییر و export حساس',
          'Audit اختصاصی دسترسی و retention intent',
          'انتشار Payroll Input حداقلی و تأییدشده برای Finance',
        ],
      },
    ],
    permissions: [
      'hr.employee.read',
      'hr.employee.read_sensitive',
      'hr.employee.manage',
      'hr.attendance.manage',
      'hr.leave.approve',
      'hr.payroll_input.export',
    ],
    references: [
      {
        label: 'حساب ورود',
        owner: 'IAM',
        contract: 'iam.user-reference.v2',
      },
      {
        label: 'شعبه و سمت',
        owner: 'Master Data',
        contract: 'master-data.references.v1',
      },
      {
        label: 'Payroll Input',
        owner: 'Finance',
        contract: 'finance.payroll-input.v1-proposal',
      },
    ],
    rows: sampleRows('رکورد پرسنلی'),
    outputFormats: ['گزارش HR PDF', 'ورودی پرداخت Excel'],
  },
  tasks: {
    key: 'tasks',
    title: 'وظایف و اتوماسیون',
    description:
      'وظیفه، تأیید، قانون رویدادی، زمان‌بندی و نتیجه اجرای قابل پیگیری.',
    boundary:
      'این ماژول فرآیند را هماهنگ می‌کند و invariant یا جدول ماژول مرجع را تغییر مستقیم نمی‌دهد.',
    createLabel: 'وظیفه جدید',
    metrics: metrics([
      'وظایف امروز',
      'عقب‌افتاده',
      'تأیید منتظر',
      'اجرای ناموفق',
    ]),
    sections: [
      {
        title: 'وظایف',
        description: 'فردی و گروهی',
        items: [
          'مسئول، ناظر، سررسید و اولویت',
          'Checklist، پیوست و ارتباط پیشنهادی با رکورد CRM',
          'تکرار، وضعیت و تاریخچه اقدام',
        ],
      },
      {
        title: 'مراحل تأیید',
        description: 'Approval workflow',
        items: [
          'تأیید قرارداد و تخفیف',
          'تأیید خرید و پرداخت',
          'تأیید تحویل مدارک با actor و reason',
        ],
      },
      {
        title: 'اتوماسیون',
        description: 'Rule و Run',
        items: [
          'قانون رویدادی و اجرای زمان‌بندی‌شده',
          'اعلان، یادآوری، Retry و Escalation',
          'ثبت نتیجه اجرا، attempt و خطای redacted',
        ],
      },
    ],
    permissions: [
      'tasks.read',
      'tasks.create',
      'tasks.assign',
      'tasks.approve',
      'automation.rule.manage',
      'automation.run.read',
    ],
    references: [
      {
        label: 'مسئول و ناظر',
        owner: 'IAM',
        contract: 'iam.actor-reference.v2',
      },
      {
        label: 'رکورد CRM',
        owner: 'Domain owner',
        contract: 'domain.reference-envelope.v1 (پیشنهادی)',
      },
      {
        label: 'اعلان',
        owner: 'Notifications',
        contract: 'notification.request.v1 (پیشنهادی)',
      },
    ],
    rows: sampleRows('وظیفه'),
    outputFormats: ['وظایف Excel', 'گزارش اجرا PDF'],
  },
  documents: {
    key: 'documents',
    title: 'اسناد و فایل‌ها',
    description:
      'دریافت و نگهداری Artifact نهایی، آرشیو، نسخه‌بندی، محرمانگی، دسترسی و retention فایل‌های همه دامنه‌ها.',
    boundary:
      'تولید، صدور و Render هر سند متعلق به ماژول اصلی است؛ Documents فقط Artifact نهایی را برای نگهداری، archive، version، confidentiality/access، expiry/retention، file owner، download/view audit و secure link دریافت می‌کند.',
    createLabel: 'ثبت metadata فایل',
    metrics: metrics([
      'اسناد جدید',
      'نزدیک انقضا',
      'محرمانه',
      'در انتظار آرشیو',
    ]),
    sections: [
      {
        title: 'مرز تولید و تحویل',
        description: 'Domain-owned generation',
        items: [
          'Sales: تولید قرارداد',
          'Reservations: تولید بلیت، Manifest، فرم رزرو، واچر و بیمه',
          'Finance: تولید رسید، فاکتور و خروجی مالی خودش',
          'Purchases: تولید سفارش و اسناد خرید؛ HR: تولید اسناد پرسنلی',
        ],
      },
      {
        title: 'انواع سند',
        description: 'آرشیو همه دامنه‌ها',
        items: [
          'مشتری، پاسپورت، پیشنهاد، قرارداد و پیوست',
          'بلیت، Manifest، فرم هتل، واچر و بیمه‌نامه',
          'فاکتور، رسید، خرید، مالی، سازمانی و منابع انسانی',
        ],
      },
      {
        title: 'چرخه فایل',
        description: 'Version و classification',
        items: [
          'دسته‌بندی، نسخه‌بندی و مالک فایل',
          'محرمانگی، تاریخ انقضا و retention intent',
          'Checksum و وضعیت pending/ready در اتصال آینده storage',
        ],
      },
      {
        title: 'دسترسی امن',
        description: 'Permission-aware',
        items: [
          'سابقه مشاهده، دانلود و ارسال',
          'لینک امن کوتاه‌عمر و قابل لغو',
          'Audit actor، زمان، علت و دامنه مرجع',
        ],
      },
    ],
    permissions: [
      'documents.read',
      'documents.upload',
      'documents.version.manage',
      'documents.confidential.read',
      'documents.link.create',
      'documents.audit.read',
    ],
    references: [
      {
        label: 'مالک معنایی',
        owner: 'Domain owner',
        contract: 'documents.archive-intent.v1 (پیشنهادی)',
      },
      {
        label: 'فایل باینری',
        owner: 'Object Storage',
        contract: 'storage.object-reference.v1 (پیشنهادی)',
      },
      {
        label: 'مجوز مالی',
        owner: 'Finance',
        contract: 'finance.financial-release.v1-proposal',
      },
    ],
    rows: sampleRows('سند'),
    outputFormats: ['فهرست metadata CSV', 'گزارش دسترسی PDF'],
  },
  reports: {
    key: 'reports',
    title: 'گزارش‌ها',
    description:
      'کاتالوگ گزارش‌های grain-safe، فیلتر، View ذخیره‌شده و زمان‌بندی خروجی.',
    boundary:
      'گزارش رسمی فقط approved view با grain صریح را مصرف می‌کند و مبلغ را با passenger/segment تکثیر نمی‌کند.',
    createLabel: 'گزارش سفارشی',
    metrics: metrics([
      'گزارش‌های آماده',
      'View ذخیره‌شده',
      'اجرای زمان‌بندی',
      'خروجی در صف',
    ]),
    sections: [
      {
        title: 'فروش و عملیات',
        description: 'Grainهای جدا',
        items: [
          'مشتری، Lead، قرارداد، فروش و تخصیص مسافر',
          'رزرواسیون، ظرفیت، صدور بلیت و Manifest',
          'هتل، واچر، بیمه و عملیات تغییر/استرداد',
        ],
      },
      {
        title: 'خرید و سود',
        description: 'Margin معتبر',
        items: [
          'درخواست خرید، کارگزار و تخفیف',
          'قیمت خالص خرید و بدهی تأمین‌کننده',
          'سود خدمت و قرارداد از snapshotهای معتبر',
        ],
      },
      {
        title: 'مالی و عملکرد',
        description: 'Permission-aware',
        items: [
          'گردش حساب، چک، بدهکار و بستانکار',
          'شعب، کاربران، کارگزاران و سازمان‌ها',
          'مارکتینگ، پشتیبانی و منابع انسانی',
        ],
      },
      {
        title: 'Report Builder',
        description: 'طراحی پیشنهادی',
        items: [
          'فیلتر، مرتب‌سازی، ستون و grain مشخص',
          'ذخیره View و زمان‌بندی اجرا',
          'مسیر PDF، Excel و CSV بدون تولید فایل جعلی',
        ],
      },
    ],
    permissions: [
      'reporting.read',
      'reporting.builder.use',
      'reporting.view.save',
      'reporting.schedule.manage',
      'reporting.export',
      'reporting.sensitive.read',
    ],
    references: [
      {
        label: 'Fact views',
        owner: 'Reporting Backend',
        contract: 'reporting.approved-view.v1 (پیشنهادی)',
      },
      {
        label: 'Artifact',
        owner: 'Documents',
        contract: 'documents.export-artifact.v1 (پیشنهادی)',
      },
      {
        label: 'اجرای طولانی',
        owner: 'Worker',
        contract: 'worker.report-run.v1 (پیشنهادی)',
      },
    ],
    rows: sampleRows('گزارش'),
    outputFormats: ['PDF', 'Excel', 'CSV'],
  },
  integrations: {
    key: 'integrations',
    title: 'یکپارچه‌سازی‌ها',
    description:
      'اتصال دو سایت، Providerها، پیام‌رسانی، پرداخت و سیستم‌های بیرونی با کنترل سلامت.',
    boundary:
      'Credential فقط reference امن است؛ Secret، payload حساس و log خام در UI یا Git نمایش داده نمی‌شود.',
    createLabel: 'تعریف اتصال Preview',
    metrics: metrics([
      'اتصال تعریف‌شده',
      'سلامت مناسب',
      'Retry در صف',
      'Webhook نیازمند بررسی',
    ]),
    sections: [
      {
        title: 'کانال‌ها و Providerها',
        description: 'دو سایت و خدمات سفر',
        items: [
          'سایت اول و دوم، API پرواز، هتل، اتوبوس و تور',
          'API بیمه سامان و قالب Excel ایرلاین',
          'درگاه پرداخت، پیامک، ایمیل و حسابداری',
        ],
      },
      {
        title: 'محیط و نگاشت',
        description: 'Sandbox / Production',
        items: [
          'محیط تست و عملیاتی جدا با credential reference',
          'نگاشت کد خارجی و مدل normalized',
          'Webhook history و Sync job پیشنهادی',
        ],
      },
      {
        title: 'تاب‌آوری و امنیت',
        description: 'Operational controls',
        items: [
          'Log امن و Redacted، Timeout و Rate Limit',
          'Retry محدود، Idempotency و circuit breaker',
          'جلوگیری از صدور/پرداخت تکراری و سلامت Provider',
        ],
      },
    ],
    permissions: [
      'integrations.read',
      'integrations.manage',
      'integrations.health.read',
      'integrations.log.read',
      'integrations.retry',
      'integrations.environment.promote',
    ],
    references: [
      {
        label: 'Provider profile',
        owner: 'Master Data',
        contract: 'master-data.providers.v1',
      },
      {
        label: 'Intent رزرو',
        owner: 'Reservations',
        contract: 'reservations.provider-intent.v1 (پیشنهادی)',
      },
      {
        label: 'Credential',
        owner: 'Secret Manager',
        contract: 'secret.reference.v1 (پیشنهادی)',
      },
    ],
    rows: sampleRows('اتصال'),
    outputFormats: ['سلامت CSV', 'خطاهای Redacted PDF'],
  },
  system: {
    key: 'system',
    title: 'مدیریت سیستم',
    description:
      'درگاه IAM موجود و تنظیمات عمومی، عملیاتی، امنیتی و تجاری سامانه.',
    boundary:
      'IAM و Settings فقط در Navigation یک منو هستند؛ داده، قرارداد و Backend مستقل باقی می‌مانند.',
    createLabel: 'تنظیم Preview',
    metrics: metrics([
      'کاربران فعال',
      'نشست‌های فعال',
      'تنظیمات نیازمند بازبینی',
      'رخداد Audit',
    ]),
    sections: [
      {
        title: 'کاربران و دسترسی',
        description: 'IAM موجود',
        items: [
          'کاربران، نقش‌ها، Permissionها، تیم‌ها و شعب',
          'Scope فروش/رزرواسیون/مالی/قیمت خرید/HR',
          'نشست فعال، ورود دومرحله‌ای، تاریخچه ورود و Audit',
        ],
      },
      {
        title: 'شرکت و نمایش',
        description: 'Settings Preview',
        items: [
          'مشخصات شرکت، لوگو، برند و دو دامنه',
          'زبان، منطقه زمانی، تاریخ شمسی، تقویم و تعطیلات',
          'شعب و تنظیمات نمایشی نسخه‌دار',
        ],
      },
      {
        title: 'تنظیمات عملیاتی',
        description: 'قواعد Workflow',
        items: [
          'شماره‌گذاری قرارداد، سفارش، بلیت و واچر',
          'قواعد Hold و زمان‌بندی Manifest',
          'صدور، تحویل، کنسلی و استرداد',
        ],
      },
      {
        title: 'امنیت و تجارت',
        description: 'Policyها',
        items: [
          'Markup، محدوده تخفیف و قالب PDF',
          'قالب پیامک/ایمیل، سیاست رمز و Session',
          'API، SLA و نگهداری Log',
        ],
      },
    ],
    permissions: [
      'iam.user.manage',
      'iam.role.manage',
      'iam.audit.read',
      'settings.read',
      'settings.manage',
      'settings.security.manage',
    ],
    references: [
      {
        label: 'کاربران و نقش‌ها',
        owner: 'IAM',
        contract: 'iam.v2',
      },
      {
        label: 'تنظیم موثر',
        owner: 'Settings',
        contract: 'settings.effective-setting.v1 (پیشنهادی)',
      },
      {
        label: 'شعبه',
        owner: 'Master Data',
        contract: 'master-data.branch-reference.v1',
      },
    ],
    rows: sampleRows('تنظیم'),
    outputFormats: ['Audit PDF', 'تنظیمات CSV'],
  },
};
