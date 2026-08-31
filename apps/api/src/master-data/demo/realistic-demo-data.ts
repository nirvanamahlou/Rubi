import { masterDataDemoRecords, type DemoRecord } from './demo-data';

export const REALISTIC_DEMO_REVISION = 'catalog-examples-v2';

/** Public geography/currency/model labels plus fictional businesses. Never operational data. */
export function realisticMasterDataDemoRecords(): DemoRecord[] {
  const pair = (fa: string, en: string) => ({ name: fa, englishName: en });
  const overrides: Record<
    string,
    Record<string, string | number | readonly string[] | null>
  > = {
    country: { iso2Code: 'TR', ...pair('ترکیه', 'Türkiye') },
    currency: { code: 'EUR', ...pair('یورو', 'Euro'), symbol: '€' },
    'service-hotel': { ...pair('رزرو هتل', 'Hotel Reservation') },
    'service-tour': { ...pair('اجرای تور و گشت', 'Tours and Excursions') },
    'region-1': {
      ...pair('استان استانبول', 'Istanbul Province'),
      type: 'PROVINCE',
    },
    'region-2': {
      ...pair('استان آنتالیا', 'Antalya Province'),
      type: 'PROVINCE',
    },
    'city-1': pair('استانبول', 'Istanbul'),
    'city-2': pair('آنتالیا', 'Antalya'),
    'bank-1': pair('بانک افق آبی', 'Blue Horizon Bank'),
    'bank-2': pair('بانک سپیدار', 'Sepidar Bank'),
    'branch-1': {
      ...pair('شعبه مرکز استانبول', 'Istanbul Central Branch'),
      address: 'مرکز شهر، بلوار ساحلی، ساختمان افق — نشانی نمایشی',
    },
    'branch-2': {
      ...pair('شعبه مرکز آنتالیا', 'Antalya Central Branch'),
      address: 'مرکز شهر، خیابان گردشگری، ساختمان سپیدار — نشانی نمایشی',
    },
    'organization-1': {
      legalName: 'شرکت گردشگری افق فیروزه',
      displayName: 'افق فیروزه',
      personType: 'LEGAL',
    },
    'organization-2': {
      legalName: 'شرکت خدمات سفر آبیراه',
      displayName: 'آبیراه سفر',
      personType: 'LEGAL',
    },
    'contact-1': {
      fullName: 'واحد هماهنگی رزرو',
      jobTitle: 'پشتیبانی تأمین‌کننده',
    },
    'contact-2': {
      fullName: 'واحد عملیات مقصد',
      jobTitle: 'هماهنگی خدمات سفر',
    },
    'supplier-1': { englishName: 'Turquoise Horizon Travel' },
    'supplier-2': { englishName: 'Abirah Travel Services' },
    'broker-1': pair('کارگزاری افق استانبول', 'Horizon Istanbul DMC'),
    'broker-2': pair('کارگزاری آبیراه آنتالیا', 'Abirah Antalya DMC'),
    airport: {
      ...pair(
        'فرودگاه نمایشی ساحل فیروزه',
        'Turquoise Coast Demonstration Airport',
      ),
      ianaTimezone: 'Europe/Istanbul',
      latitude: '41.1',
      longitude: '28.8',
    },
    'terminal-1': pair('ترمینال پروازهای داخلی', 'Domestic Terminal'),
    'terminal-2': pair('ترمینال پروازهای بین‌المللی', 'International Terminal'),
    'terminal-3': pair('ترمینال تشریفات اختصاصی', 'VIP Terminal'),
    'payment-1': { name: 'پرداخت نقدی' },
    'payment-2': { name: 'حواله بانکی' },
    'payment-3': { name: 'کارت‌خوان شعبه' },
    'facility-1': { ...pair('اینترنت بی‌سیم', 'Wi-Fi'), category: 'ارتباطات' },
    'facility-2': {
      ...pair('استخر', 'Swimming Pool'),
      category: 'تفریح و تندرستی',
    },
    'facility-3': {
      ...pair('پذیرایی', 'Refreshments'),
      category: 'خدمات رفاهی',
    },
    'meal-1': { ...pair('اتاق و صبحانه', 'Bed & Breakfast'), code: 'BB' },
    'meal-2': { ...pair('آل اینکلوسیو', 'All Inclusive'), code: 'ALL' },
    chain: pair('گروه هتل‌های آبیراه', 'Abirah Hotels'),
    'room-1': {
      ...pair('اتاق دبل استاندارد', 'Standard Double Room'),
      usageDescription: 'اتاق دو نفره با یک تخت دونفره',
    },
    'room-2': {
      ...pair('سوئیت خانوادگی', 'Family Suite'),
      usageDescription: 'سوئیت سه نفره مناسب خانواده',
    },
    'hotel-1': {
      ...pair('هتل آبیراه بسفر', 'Abirah Bosphorus Hotel'),
      address: 'استانبول، محدوده ساحل بسفر — نشانی نمایشی',
      latitude: '41.04',
      longitude: '29.01',
      checkInTime: '14:00',
      checkOutTime: '12:00',
    },
    'hotel-2': {
      ...pair('هتل باغ فیروزه', 'Turquoise Garden Hotel'),
      address: 'استانبول، محدوده مرکزی شهر — نشانی نمایشی',
      latitude: '41.03',
      longitude: '28.98',
      checkInTime: '15:00',
      checkOutTime: '12:00',
    },
    'airline-1': pair('هواپیمایی افق فیروزه', 'Turquoise Horizon Airways'),
    'airline-2': pair('هواپیمایی آبیراه', 'Abirah Airways'),
    'aircraft-1': {
      ...pair('ایرباس ۳۲۰', 'Airbus A320'),
      manufacturer: 'Airbus',
      model: 'A320-200',
    },
    'aircraft-2': {
      ...pair('بوئینگ ۷۷۷', 'Boeing 777'),
      manufacturer: 'Boeing',
      model: '777-300ER',
    },
    'cabin-1': { ...pair('اکونومی', 'Economy'), bookingCode: 'Y' },
    'cabin-2': { ...pair('بیزینس', 'Business'), bookingCode: 'C' },
    'baggage-1': {
      name: 'بار بزرگسال اکونومی',
      allowance: '20',
      pieceCount: 1,
      routeScope: 'DOMESTIC',
    },
    'baggage-2': {
      name: 'بار بزرگسال بیزینس',
      allowance: '30',
      pieceCount: 2,
      routeScope: 'INTERNATIONAL',
    },
    'manifest-1': {
      name: 'فهرست مسافران پرواز — اکسل',
      sheetName: 'Passengers',
    },
    'manifest-2': { name: 'فهرست مسافران پرواز — CSV', sheetName: null },
    'rail-1': pair('ریل آبیراه', 'Abirah Rail'),
    'rail-2': pair('راه‌آهن افق', 'Horizon Rail'),
    'train-1': {
      ...pair('قطار سالنی سریع‌السیر', 'Express Saloon Train'),
      manufacturer: 'Siemens',
      model: 'Velaro',
      category: 'EXPRESS',
    },
    'train-2': {
      ...pair('قطار کوپه‌ای خواب', 'Sleeper Compartment Train'),
      manufacturer: 'Wagon Pars',
      model: 'Sleeper',
      category: 'SLEEPER',
    },
    'bus-company-1': pair('سفرهای جاده‌ای آبیراه', 'Abirah Coach Travel'),
    'bus-company-2': pair('گشت زمینی افق', 'Horizon Ground Travel'),
    'bus-type-1': {
      ...pair('اسکانیا کلاسیک', 'Scania Classic'),
      manufacturer: 'Scania',
      model: 'Classic',
    },
    'bus-type-2': {
      ...pair('ولوو B9R وی‌آی‌پی', 'Volvo B9R VIP'),
      manufacturer: 'Volvo',
      model: 'B9R',
    },
    'insurer-1': pair('پوشش سفر افق', 'Horizon Travel Protection'),
    'insurer-2': pair('پوشش سفر آبیراه', 'Abirah Travel Protection'),
    'coverage-1': {
      ...pair('هزینه‌های فوریت پزشکی', 'Emergency Medical Expenses'),
      description: 'پوشش نمایشی برای بررسی فرم؛ فاقد اعتبار بیمه‌نامه',
      coverageLimit: '30000',
    },
    'coverage-2': {
      ...pair('تأخیر و مفقودی بار', 'Baggage Delay and Loss'),
      description: 'پوشش نمایشی برای بررسی فرم؛ فاقد اعتبار بیمه‌نامه',
      coverageLimit: '1500',
    },
    'plan-1': {
      ...pair('بسته سفر کوتاه‌مدت', 'Short Stay Travel Plan'),
      destinationRegion: 'اروپا و حوزه مدیترانه',
    },
    'plan-2': {
      ...pair('بسته سفر خانوادگی', 'Family Travel Plan'),
      destinationRegion: 'اروپا و حوزه مدیترانه',
    },
    'leader-1': {
      ...pair('راهنمای فارسی‌زبان استانبول', 'Istanbul Persian-speaking Guide'),
      destinations: ['استانبول'],
      expertise: 'گشت شهری و تاریخ و فرهنگ',
    },
    'leader-2': {
      ...pair('راهنمای فارسی‌زبان آنتالیا', 'Antalya Persian-speaking Guide'),
      destinations: ['آنتالیا'],
      expertise: 'گردشگری ساحلی و طبیعت‌گردی',
    },
    'tour-1': {
      ...pair('گشت شهری', 'City Tour'),
      description: 'بازدید از جاذبه‌های فرهنگی و تاریخی شهر',
    },
    'tour-2': {
      ...pair('سفر چندشهری', 'Multi-city Tour'),
      description: 'نوع مرجع سفر بین چند مقصد',
    },
    'transfer-1': {
      ...pair('ترانسفر اختصاصی فرودگاه', 'Private Airport Transfer'),
      description: 'خودروی اختصاصی برای رفت‌وآمد فرودگاه',
    },
    'transfer-2': {
      ...pair('ترانسفر اشتراکی ون', 'Shared Van Transfer'),
      description: 'انتقال گروهی مسافران با ون',
    },
    'visa-1': {
      ...pair('خدمات بررسی مدارک سفر', 'Travel Document Review'),
      visaType: 'گردشگری',
    },
    'visa-2': {
      ...pair('خدمات پیگیری درخواست سفر', 'Travel Application Assistance'),
      visaType: 'تجاری',
    },
    'acquaintance-methods-1': pair('معرفی دوستان و آشنایان', 'Word of Mouth'),
    'acquaintance-methods-2': pair('جست‌وجوی اینترنتی', 'Online Search'),
    'sales-channels-1': pair('فروش حضوری شعبه', 'Branch Sales'),
    'sales-channels-2': pair('فروش وب‌سایت', 'Website Sales'),
    'lost-reasons-1': pair('عدم تناسب قیمت با بودجه', 'Budget Mismatch'),
    'lost-reasons-2': pair('تغییر برنامه سفر', 'Travel Plan Changed'),
    'tags-1': pair('سفر خانوادگی', 'Family Travel'),
    'tags-2': pair('سفر کاری', 'Business Travel'),
    composite: pair(
      'اقامت ترکیبی آبیراه و باغ فیروزه',
      'Abirah and Turquoise Garden Stay',
    ),
  };
  const original = masterDataDemoRecords();
  for (const key of Object.keys(overrides)) {
    if (!original.some((row) => row.key === key))
      throw new Error(`Unknown fixture: ${key}`);
  }
  return original.map((fixture) => ({
    ...fixture,
    values: (id) => ({ ...fixture.values(id), ...overrides[fixture.key] }),
  }));
}
