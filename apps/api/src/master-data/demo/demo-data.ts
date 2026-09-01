import type { MasterDataResource } from '@rubi/contracts';

export const DEMO_PREFIX = 'rubi-master-demo-v1';
export const DEMO_EXCLUDED = [
  'exchange-rates',
  'cip-services',
  'lead-sources',
  'customer-types',
  'campaign-types',
] as const;
export type DemoResource = Exclude<
  MasterDataResource,
  (typeof DEMO_EXCLUDED)[number]
>;
type Values = Record<string, string | number | readonly string[] | null>;
export type DemoRecord = {
  key: string;
  resource: DemoResource;
  values: (id: (key: string) => string) => Values;
};

/** Explicit synthetic fixtures, never part of the normal application seed. */
export function masterDataDemoRecords(): DemoRecord[] {
  const records: DemoRecord[] = [];
  const add = (
    key: string,
    resource: DemoResource,
    values: Values | DemoRecord['values'],
  ) =>
    records.push({
      key,
      resource,
      values: typeof values === 'function' ? values : () => values,
    });
  const name = (label: string) => `${label} — آزمایشی`;
  const validFrom = '2026-01-01';
  const validTo = '2030-12-31';
  add('country', 'countries', {
    iso2Code: 'AQ',
    name: name('جنوبگان'),
    englishName: 'Antarctica - Demo',
  });
  add('currency', 'currencies', {
    code: 'XTS',
    name: name('ارز تست'),
    englishName: 'Testing Currency - Demo',
    symbol: 'XTS',
    decimalDigits: 2,
  });
  add('service-hotel', 'travel-services', {
    code: 'DEMO_HOTEL',
    name: name('خدمات هتل'),
    englishName: 'Demo Hotel Service',
  });
  add('service-tour', 'travel-services', {
    code: 'DEMO_TOUR',
    name: name('خدمات تور'),
    englishName: 'Demo Tour Service',
  });
  for (const n of [1, 2]) {
    add(`region-${n}`, 'regions', (id) => ({
      countryId: id('country'),
      name: name(`ناحیه نمونه ${n}`),
      englishName: `Demo Region ${n}`,
      type: 'REGION',
    }));
    add(`city-${n}`, 'cities', (id) => ({
      countryId: id('country'),
      regionId: id(`region-${n}`),
      name: name(`شهر نمونه ${n}`),
      englishName: `Demo City ${n}`,
    }));
    add(`bank-${n}`, 'banks', (id) => ({
      code: `DEMO_BANK_${n}`,
      name: name(`بانک نمونه ${n}`),
      englishName: `Demo Bank ${n}`,
      countryId: id('country'),
    }));
    add(`branch-${n}`, 'bank-branches', (id) => ({
      code: `DEMO_BRANCH_${n}`,
      name: name(`شعبه نمونه ${n}`),
      englishName: `Demo Branch ${n}`,
      bankId: id(`bank-${n}`),
      cityId: id(`city-${n}`),
      address: 'نشانی کاملاً ساختگی برای آزمایش فرم؛ فاقد کاربرد واقعی',
    }));
    add(`organization-${n}`, 'organizations', {
      legalName: name(`سازمان نمونه ${n}`),
      displayName: name(`سازمان نمونه ${n}`),
      personType: n === 1 ? 'LEGAL' : 'NATURAL',
      roleCodes: [
        'SUPPLIER',
        'BROKER',
        'AIRLINE',
        'HOTEL_PROVIDER',
        'INSURANCE_PROVIDER',
        'RAIL_OPERATOR',
        'BUS_PROVIDER',
      ],
    });
    add(`contact-${n}`, 'organization-contacts', (id) => ({
      organizationId: id(`organization-${n}`),
      fullName: name(`مخاطب ساختگی ${n}`),
      jobTitle: 'مسئول تست',
      preferredChannel: 'EMAIL',
      email: `master-demo-${n}@example.invalid`,
      isPrimary: 'true',
    }));
    add(`supplier-${n}`, 'suppliers', (id) => ({
      organizationId: id(`organization-${n}`),
      englishName: `Demo Supplier ${n}`,
      primaryContactId: id(`contact-${n}`),
      countryId: id('country'),
      cityId: id(`city-${n}`),
      collaborationStatus: n === 1 ? 'ACTIVE' : 'UNDER_REVIEW',
      serviceCodes: ['DEMO_HOTEL', 'DEMO_TOUR'],
    }));
    add(`broker-${n}`, 'brokers', (id) => ({
      name: name(`کارگزار نمونه ${n}`),
      englishName: `Demo Broker ${n}`,
      organizationId: id(`organization-${n}`),
      primaryContactId: id(`contact-${n}`),
      countryId: id('country'),
      cityId: id(`city-${n}`),
      collaborationStatus: 'ACTIVE',
      serviceCodes: ['DEMO_HOTEL', 'DEMO_TOUR'],
    }));
  }
  add('airport', 'airports', (id) => ({
    name: name('فرودگاه نمونه'),
    englishName: 'Demo Airport',
    countryId: id('country'),
    cityId: id('city-1'),
    iataCode: 'ZZX',
    icaoCode: 'ZZZX',
    ianaTimezone: 'Etc/UTC',
    latitude: '-75',
    longitude: '0',
  }));
  for (const [n, kind, label] of [
    [1, 'DOMESTIC', 'داخلی'],
    [2, 'INTERNATIONAL', 'بین‌المللی'],
    [3, 'VIP', 'وی‌آی‌پی'],
  ] as const)
    add(`terminal-${n}`, 'terminals', (id) => ({
      name: name(`ترمینال ${label}`),
      englishName: `Demo Terminal ${n}`,
      airportId: id('airport'),
      terminalType: kind,
      gateCount: n + 1,
      operatingHoursMode: 'ALL_DAY',
    }));
  for (const [n, channel, label] of [
    [1, 'CASH', 'نقدی'],
    [2, 'BANK_TRANSFER', 'حواله بانکی'],
    [3, 'POS', 'کارت‌خوان'],
  ] as const)
    add(`payment-${n}`, 'payment-methods', {
      name: name(`پرداخت ${label}`),
      channel,
      direction: 'BOTH',
      requiresManualApproval: 'true',
      displayOrder: n,
      description: 'صرفاً مرجع آزمایشی؛ بدون حساب، کارت یا اتصال درگاه',
    });
  for (const [n, label, englishName] of [
    [1, 'وای‌فای', 'Wi-Fi'],
    [2, 'استخر', 'Pool'],
    [3, 'پذیرایی', 'Refreshment'],
  ] as const)
    add(`facility-${n}`, 'facilities', {
      name: name(label),
      englishName: `Demo ${englishName}`,
      category: 'آزمایشی',
      displayOrder: n,
    });
  add('meal-1', 'meal-services', {
    code: 'DEMO_BB',
    name: name('اتاق و صبحانه'),
    englishName: 'Demo Bed and Breakfast',
    category: 'MEAL_PLAN',
    includedMeals: ['صبحانه'],
    status: 'active',
  });
  add('meal-2', 'meal-services', {
    code: 'DEMO_ALL',
    name: name('سرویس کامل'),
    englishName: 'Demo All Inclusive',
    category: 'SERVICE',
    includedMeals: ['صبحانه', 'ناهار', 'شام', 'میان‌وعده'],
    status: 'active',
  });
  add('chain', 'hotel-chains', (id) => ({
    name: name('زنجیره هتل نمونه'),
    englishName: 'Demo Hotel Chain',
    countryId: id('country'),
    website: 'https://hotels.example.invalid',
  }));
  for (const n of [1, 2]) {
    add(`room-${n}`, 'room-types', {
      name: name(`اتاق نمونه ${n}`),
      englishName: `Demo Room ${n}`,
      referenceCapacity: n + 1,
      usageDescription: 'ظرفیت مرجع صرفاً آزمایشی',
    });
    add(`hotel-${n}`, 'hotels', (id) => ({
      name: name(`هتل نمونه ${n}`),
      englishName: `Demo Hotel ${n}`,
      cityId: id('city-1'),
      chainId: id('chain'),
      starRating: n + 3,
      address: 'نشانی ساختگی هتل آزمایشی',
      description: 'داده نمایشی محلی؛ فاقد رزرو یا قرارداد واقعی',
      website: `https://hotel-${n}.example.invalid`,
      checkInTime: '14:00',
      checkOutTime: '12:00',
      latitude: '-75',
      longitude: '0',
      isSaleableReference: 'true',
      mealServiceIds: [id('meal-1'), id('meal-2')],
      roomTypeIds: [id(`room-${n}`)],
      facilityIds: [id('facility-1'), id('facility-2')],
    }));
    add(`airline-${n}`, 'airlines', (id) => ({
      code: `Z${n}`,
      icaoCode: `ZZ${n}`,
      name: name(`ایرلاین نمونه ${n}`),
      englishName: `Demo Airline ${n}`,
      organizationId: id(`organization-${n}`),
      countryId: id('country'),
    }));
    add(`aircraft-${n}`, 'aircraft-types', {
      name: name(`هواپیمای نمونه ${n}`),
      englishName: `Demo Aircraft ${n}`,
      manufacturer: 'Demo Manufacturer',
      model: `DEMO-${n}`,
      bodyType: n === 1 ? 'NARROW_BODY' : 'WIDE_BODY',
    });
    add(`cabin-${n}`, 'cabin-classes', {
      name: name(n === 1 ? 'اکونومی' : 'بیزینس'),
      englishName: `Demo Cabin ${n}`,
      bookingCode: `DEMO${n}`,
      cabinType: n === 1 ? 'ECONOMY' : 'BUSINESS',
      displayOrder: n,
    });
    add(`baggage-${n}`, 'baggage-rules', (id) => ({
      name: name(`قاعده بار نمونه ${n}`),
      airlineId: id(`airline-${n}`),
      cabinClassId: id(`cabin-${n}`),
      passengerType: 'ADT',
      routeScope: 'ALL',
      allowance: String(n * 10),
      unit: 'KG',
      pieceCount: n,
      validFrom,
      validTo,
      description: 'قاعده ساختگی تست؛ غیرقابل استفاده برای صدور واقعی',
    }));
    add(`manifest-${n}`, 'manifest-templates', (id) => ({
      name: name(`قالب مانیفست ${n}`),
      airlineId: id(`airline-${n}`),
      versionNumber: 1,
      fileFormat: n === 1 ? 'XLSX' : 'CSV',
      headerRow: 1,
      sheetName: 'Demo',
      dateFormat: 'YYYY-MM-DD',
      requiredColumns: ['sequence', 'displayName'],
      columnOrder: ['sequence', 'displayName'],
      validFrom,
      validTo,
      publicationStatus: 'DRAFT',
    }));
    add(`rail-${n}`, 'rail-companies', (id) => ({
      name: name(`شرکت ریلی ${n}`),
      englishName: `Demo Rail ${n}`,
      organizationId: id(`organization-${n}`),
      countryId: id('country'),
    }));
    add(`train-${n}`, 'train-types', (id) => ({
      name: name(`قطار نمونه ${n}`),
      englishName: `Demo Train ${n}`,
      manufacturer: 'Demo Manufacturer',
      model: `DEMO-${n}`,
      category: n === 1 ? 'SLEEPER' : 'EXPRESS',
      facilityIds: [id('facility-1'), id('facility-3')],
    }));
    add(`bus-company-${n}`, 'bus-companies', (id) => ({
      name: name(`شرکت اتوبوس ${n}`),
      englishName: `Demo Bus Company ${n}`,
      organizationId: id(`organization-${n}`),
      countryId: id('country'),
    }));
    add(`bus-type-${n}`, 'bus-types', (id) => ({
      name: name(`اتوبوس نمونه ${n}`),
      englishName: `Demo Bus ${n}`,
      manufacturer: 'Demo Manufacturer',
      model: `DEMO-${n}`,
      serviceClass: n === 1 ? 'STANDARD' : 'VIP',
      facilityIds: [id('facility-1'), id('facility-3')],
    }));
    add(`insurer-${n}`, 'insurers', (id) => ({
      name: name(`بیمه‌گر نمونه ${n}`),
      englishName: `Demo Insurer ${n}`,
      organizationId: id(`organization-${n}`),
      countryId: id('country'),
    }));
    add(`coverage-${n}`, 'insurance-coverages', (id) => ({
      name: name(`پوشش نمونه ${n}`),
      englishName: `Demo Coverage ${n}`,
      currencyId: id('currency'),
      coverageLimit: String(1000 * n),
      deductibleAmount: '0',
      description: 'پوشش ساختگی با ارز تست XTS؛ بدون بیمه‌نامه واقعی',
    }));
    add(`plan-${n}`, 'insurance-plans', (id) => ({
      name: name(`طرح بیمه نمونه ${n}`),
      englishName: `Demo Plan ${n}`,
      insurerId: id(`insurer-${n}`),
      destinationRegion: 'منطقه آزمایشی',
      minimumAge: 0,
      maximumAge: 80,
      validFrom,
      validTo,
      coverageIds: [id(`coverage-${n}`)],
      description: 'طرح صرفاً آزمایشی',
    }));
    add(`leader-${n}`, 'leaders', (id) => ({
      name: name(`لیدر ساختگی ${n}`),
      englishName: `Demo Guide ${n}`,
      cityId: id(`city-${n}`),
      languages: ['فارسی', 'انگلیسی'],
      destinations: ['مقصد آزمایشی'],
      expertise: 'راهنمایی آزمایشی',
      operationalNotes: 'شخص ساختگی؛ بدون شماره تماس واقعی',
    }));
    add(`tour-${n}`, 'tour-types', {
      name: name(`نوع تور ${n}`),
      englishName: `Demo Tour ${n}`,
      scope: n === 1 ? 'DOMESTIC' : 'INTERNATIONAL',
      description: 'نوع تور آزمایشی',
      displayOrder: n,
    });
    add(`transfer-${n}`, 'transfer-types', {
      name: name(`ترانسفر نمونه ${n}`),
      englishName: `Demo Transfer ${n}`,
      vehicleType: n === 1 ? 'خودرو' : 'ون',
      serviceMode: n === 1 ? 'PRIVATE' : 'SHARED',
      suggestedCapacityMin: 1,
      suggestedCapacity: n === 1 ? 4 : 8,
      description: 'نوع ترانسفر آزمایشی',
      displayOrder: n,
    });
    add(`visa-${n}`, 'visa-services', (id) => ({
      name: name(`خدمت ویزای نمونه ${n}`),
      englishName: `Demo Visa ${n}`,
      countryId: id('country'),
      supplierId: id(`supplier-${n}`),
      visaType: 'آزمایشی',
      referenceValidityMode: 'DAYS',
      referenceValidityDays: 30,
      description: 'نمونه فرم؛ بیانگر الزام یا شرایط واقعی ویزا نیست',
      displayOrder: n,
    }));
    for (const [resource, label] of [
      ['acquaintance-methods', 'نحوه آشنایی'],
      ['sales-channels', 'کانال فروش'],
      ['lost-reasons', 'دلیل باخت'],
      ['tags', 'برچسب'],
    ] as const)
      add(`${resource}-${n}`, resource, {
        name: name(`${label} نمونه ${n}`),
        englishName: `Demo ${resource} ${n}`,
        description: 'داده مرجع آزمایشی',
        displayOrder: n,
        ...(resource === 'tags'
          ? { colorHex: n === 1 ? '#DBEAFE' : '#EDE9FE' }
          : {}),
      });
  }
  add('composite', 'composite-hotels', (id) => ({
    name: name('هتل ترکیبی نمونه'),
    englishName: 'Demo Composite Hotel',
    cityId: id('city-1'),
    usageCondition: 'فقط آزمایش ترتیب و عضو پشتیبان؛ بدون فروش واقعی',
    isSaleableReference: 'false',
    memberHotelIds: [id('hotel-1'), id('hotel-2')],
    backupMemberIds: [id('hotel-2')],
  }));
  return records;
}
