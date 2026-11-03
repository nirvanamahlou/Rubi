/** Same published native projections as the API; no sample-table READY fallbacks. */
export const operationalCatalog: Readonly<
  Record<
    string,
    {
      projection: string;
      title?: string;
      dimensions: readonly string[];
      measures: readonly string[];
      filters: readonly string[];
      description: string;
    }
  >
> = {
  cancellations_refunds: {
    projection: 'sales.reporting.cancellations.v1',
    title: 'قراردادهای ایجادشده که اکنون باطل‌اند چه تعداد و چه مبلغی دارند؟',
    dimensions: ['شعبه', 'کارشناس'],
    measures: ['مبلغ قرارداد باطل‌شده'],
    filters: ['بازه تاریخ', 'شعبه', 'کارشناس', 'ارز', 'وضعیت'],
    description:
      'ابطال‌های جاری به تفکیک شعبه، کارشناس و ارز؛ تاریخ بر اساس ایجاد قرارداد است. مبلغ ابطال با فروش تأییدشده یا استرداد اجراشده جمع نمی‌شود.',
  },
  purchase_by_supplier: {
    projection: 'reservations.reporting.registered-purchases.v1',
    title: 'مبلغ خرید ثبت‌شده خدمات نزد هر تأمین‌کننده چقدر است؟',
    dimensions: ['تأمین‌کننده', 'نوع خدمت'],
    measures: ['مبلغ خرید ثبت‌شده'],
    filters: ['بازه تاریخ', 'شعبه', 'ارز', 'وضعیت'],
    description:
      'آخرین خرید ثبت‌شده هر خدمت در پرونده جاری؛ بدون جمع مجدد نسخه‌های قدیمی یا قرارداد باطل‌شده. تأیید و پرداخت مالی جداست.',
  },
  reservation_delivery_readiness: {
    projection: 'reservations.reporting.delivery.v1',
    title: 'کدام پرونده‌ها وارد رزرواسیون شده‌اند و چند مسافر مدرک دارند؟',
    dimensions: ['قرارداد', 'وضعیت ورود'],
    measures: ['مسافر دارای مدرک'],
    filters: ['بازه تاریخ', 'شعبه', 'وضعیت'],
    description:
      'آخرین نسخه پرونده تأییدشده و تعداد مسافران دارای مدرک داخلی؛ مجوز تحویل مالی یا صدور تأمین‌کننده استنتاج نمی‌شود.',
  },
  reservation_cycle_time: {
    projection: 'reservations.reporting.delivery.v1',
    title: 'از دریافت پرونده تا اولین صدور مدرک چند دقیقه گذشته است؟',
    dimensions: ['قرارداد', 'وضعیت ورود'],
    measures: ['دقیقه تا اولین مدرک'],
    filters: ['بازه تاریخ', 'شعبه', 'وضعیت'],
    description:
      'فاصله واقعی اولین دریافت پرونده تا اولین مدرک داخلی صادرشده. پرونده بدون مدرک، زمان صفر ندارد و وارد این گزارش نمی‌شود.',
  },
  tickets_manifest: {
    projection: 'reservations.reporting.delivery.v1',
    title: 'برای کدام قراردادها مدرک داخلی مسافر صادر شده است؟',
    dimensions: ['قرارداد', 'وضعیت ورود'],
    measures: ['مسافر دارای مدرک'],
    filters: ['بازه تاریخ', 'شعبه', 'وضعیت'],
    description:
      'تعداد مسافران دارای مدرک ثبت‌شده، بدون تکرار نسخه‌های پرونده؛ این گزارش مانیفست ارسال‌شده یا شماره بلیت تأمین‌کننده نیست.',
  },
  ticket_capacity: {
    projection: 'tickets.reporting.capacity.v1',
    dimensions: ['پرواز', 'زمان حرکت'],
    measures: ['تخصیص فعال'],
    filters: ['بازه تاریخ', 'شعبه', 'وضعیت'],
    description:
      'ظرفیت واقعی پرواز، تخصیص فعال، نگه‌داشت معتبر و ظرفیت باقی‌مانده؛ بازه بر اساس حرکت پرواز است.',
  },
  hotel_rate_comparison: {
    projection: 'reservations.reporting.hotel-base-rates.v1',
    title: 'نرخ پایه ثبت‌شده هتل‌ها در هر بازه چقدر است؟',
    dimensions: ['هتل', 'کارگزار'],
    measures: ['نرخ پایه ثبت‌شده'],
    filters: ['بازه تاریخ', 'شعبه', 'ارز'],
    description:
      'نرخ پایه نسخه جاری بسته هتل به تفکیک دوره اقامت و ارز؛ قیمت نهایی اتاق یا اشغال متفاوت از این نرخ است.',
  },
  customer_portfolio_growth: {
    projection: 'customers.reporting.registrations.v1',
    dimensions: ['ماه ثبت مشتری', 'نوع مشتری'],
    measures: ['مشتری ثبت‌شده'],
    filters: ['بازه تاریخ', 'شعبه'],
    description:
      'شمار هویت‌های دارای نقش مشتری به تفکیک ماه ثبت؛ بدون هویت ادغام‌شده و مسافرِ بدون نقش مشتری. این شاخص خرید موفق نیست.',
  },
  hr_performance: {
    projection: 'hr.reporting.attendance-coverage.v1',
    title: 'حضور و وضعیت ثبت کارکرد کارکنان هر واحد چگونه است؟',
    dimensions: ['روز کارکرد', 'واحد سازمانی'],
    measures: ['تعداد کارکنان'],
    filters: ['بازه تاریخ', 'شعبه', 'وضعیت'],
    description:
      'پوشش روزانه کارکرد ثبت‌شده در هر واحد و وضعیت؛ فاقد حقوق، داده حساس و امتیاز عملکرد استنتاجی.',
  },
  document_compliance: {
    projection: 'documents.reporting.compliance.v1',
    dimensions: ['ماژول مبدأ', 'وضعیت اسکن'],
    measures: ['تعداد سند'],
    filters: ['بازه تاریخ', 'شعبه'],
    description:
      'تکمیل، انقضا و وضعیت اسکن اسناد داخلیِ مجاز؛ اسناد محرمانه، حذف‌شده و ضمیمه بازخورد دیگران خارج‌اند.',
  },
  export_audit: {
    projection: 'reporting.reporting.own-export-audit.v1',
    title: 'چه خروجی‌هایی توسط حساب من ایجاد شده و وضعیت آن‌ها چیست؟',
    dimensions: ['کد گزارش', 'فرمت'],
    measures: ['تعداد فایل'],
    filters: ['بازه تاریخ', 'وضعیت'],
    description:
      'سوابق ایجاد فایل حساب جاری، فرمت، وضعیت، زمان و اندازه فایل؛ داده و فیلتر خصوصی کاربران دیگر نمایش داده نمی‌شود.',
  },
};
