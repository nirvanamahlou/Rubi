export const faMessages = {
  brand: {
    name: 'CRM شرکت نیایش سیر سحر',
    product: 'سامانه یکپارچه مدیریت سفر',
  },
  common: {
    demo: 'نمایشی',
    loading: 'در حال بارگذاری',
    retry: 'تلاش دوباره',
    noData: 'هنوز داده‌ای برای نمایش وجود ندارد',
    unavailable: 'در دسترس نیست',
    search: 'جست‌وجوی سراسری',
    searchHint: 'نام مشتری، سفارش یا بخش موردنظر را جست‌وجو کنید',
    close: 'بستن',
    cancel: 'انصراف',
    confirm: 'تأیید',
    previous: 'قبلی',
    next: 'بعدی',
  },
  shell: {
    workspace: 'فضای کاری CRM',
    branch: 'شعبه مرکزی',
    branchLabel: 'انتخاب شعبه',
    notifications: 'اعلان‌ها',
    userMenu: 'منوی کاربر',
    profile: 'پروفایل من',
    preferences: 'تنظیمات شخصی',
    signOut: 'خروج از حساب',
    collapseSidebar: 'جمع‌کردن نوار کناری',
    expandSidebar: 'بازکردن نوار کناری',
    openNavigation: 'بازکردن منوی اصلی',
    lightTheme: 'حالت روشن',
    darkTheme: 'حالت تیره',
    language: 'زبان',
    persian: 'فارسی',
    englishSoon: 'English (به‌زودی)',
  },
  placeholder: {
    eyebrow: 'زیرساخت آماده توسعه',
    title: 'این بخش برای توسعه قابلیت‌های تخصصی آماده است',
    description:
      'در این مرحله فقط مسیر، ناوبری، عنوان صفحه و وضعیت‌های استاندارد ایجاد شده‌اند و هیچ داده تجاری واقعی نمایش داده نمی‌شود.',
    emptyTitle: 'داده‌ای ثبت نشده است',
    emptyDescription:
      'پس از اتصال قرارداد تأییدشده Backend، داده‌های این بخش اینجا نمایش داده می‌شوند.',
  },
  dashboard: {
    title: 'داشبورد',
    description: 'نمای یکپارچه فروش، عملیات سفر و کارهای روزانه شرکت',
    period: 'بازه زمانی',
    periods: {
      week: '۷ روز اخیر',
      month: '۳۰ روز اخیر',
      quarter: 'سه‌ماهه اخیر',
    },
    kpis: ['فروش خالص', 'مبلغ وصول‌شده', 'سفارش‌های جدید', 'وظایف عقب‌افتاده'],
    chartTitle: 'روند عملکرد شرکت',
    recentActivity: 'فعالیت‌های اخیر',
    upcomingTasks: 'وظایف نزدیک',
    mockNotice:
      'این داشبورد فقط ساختار نمایشی دارد؛ هیچ عدد نمونه‌ای به‌عنوان داده واقعی ارائه نشده است.',
  },
  status: {
    title: 'وضعیت سرویس‌ها',
    description: 'بررسی لحظه‌ای دسترس‌پذیری Web و API',
    web: 'وضعیت Web',
    api: 'وضعیت API',
    operational: 'آماده',
    checking: 'در حال بررسی',
    offline: 'پاسخی دریافت نشد',
    notConfigured: 'آدرس API در محیط اجرا تنظیم نشده است',
    lastChecked: 'آخرین بررسی',
    neverChecked: 'هنوز بررسی نشده',
  },
} as const;

export const navigationMessages = [
  {
    title: 'داشبورد',
    href: '/dashboard',
    description: 'نمای کلی عملکرد و کارهای روزانه',
  },
  {
    title: 'مشتریان',
    href: '/customers',
    description: 'پرونده و تعاملات مشتریان',
  },
  {
    title: 'فروش و سرنخ‌ها',
    href: '/sales',
    description: 'قیف فروش و پیگیری فرصت‌ها',
  },
  {
    title: 'سفارش‌ها و رزرواسیون',
    href: '/reservations',
    description: 'سفارش‌ها، رزروها و وضعیت صدور',
  },
  {
    title: 'خدمات مشتریان',
    href: '/customer-service',
    description: 'درخواست‌ها، تیکت‌ها و SLA',
  },
  {
    title: 'خرید و تأمین',
    href: '/purchases',
    description: 'خرید خدمات و تأمین‌کنندگان',
  },
  {
    title: 'مالی و خزانه‌داری',
    href: '/finance',
    description: 'دریافت، پرداخت و خزانه',
  },
  { title: 'مارکتینگ', href: '/marketing', description: 'کمپین‌ها و مخاطبان' },
  {
    title: 'آژانس‌ها و مشتریان سازمانی',
    href: '/organizations',
    description: 'قراردادها و ارتباطات سازمانی',
  },
  {
    title: 'منابع انسانی',
    href: '/human-resources',
    description: 'پرونده و عملیات کارکنان',
  },
  {
    title: 'وظایف و اتوماسیون',
    href: '/tasks',
    description: 'کارها و جریان‌های خودکار',
  },
  {
    title: 'اسناد و فایل‌ها',
    href: '/documents',
    description: 'آرشیو و مدیریت فایل‌ها',
  },
  {
    title: 'گزارش‌ها',
    href: '/reports',
    description: 'گزارش‌ها و خروجی‌های مدیریتی',
  },
  {
    title: 'یکپارچه‌سازی‌ها',
    href: '/integrations',
    description: 'اتصال سرویس‌ها و Providerها',
  },
  {
    title: 'مدیریت کاربران',
    href: '/users',
    description: 'کاربران و سطح دسترسی',
  },
  {
    title: 'اطلاعات پایه',
    href: '/master-data',
    description: 'داده‌های مرجع سامانه',
  },
  {
    title: 'تنظیمات سیستم',
    href: '/settings',
    description: 'پیکربندی و ترجیحات سامانه',
  },
] as const;

export type NavigationHref = (typeof navigationMessages)[number]['href'];
