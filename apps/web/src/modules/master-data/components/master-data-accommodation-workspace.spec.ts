import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/master-data/components/master-data-accommodation-workspace.tsx',
  ),
  'utf8',
);
const liveFormSource = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/master-data/components/master-data-live-form.tsx',
  ),
  'utf8',
);
const referenceSelectorSource = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/master-data/components/master-data-reference-selector.tsx',
  ),
  'utf8',
);
const catalogSource = readFileSync(
  resolve(process.cwd(), 'src/modules/master-data/model/catalog.ts'),
  'utf8',
);

describe('accommodation workspace', () => {
  it('omits only the HOTEL_PROVIDER column from hotel rows and keeps alignment', () => {
    const tableStart = source.indexOf('function table()');
    const hotelHeadersStart = source.indexOf("tab === 'hotels'", tableStart);
    const headersSource = source.slice(
      source.indexOf('? [', hotelHeadersStart),
      source.indexOf(": tab === 'chains'", hotelHeadersStart),
    );
    const headers = [...headersSource.matchAll(/'([^']+)'/g)].map(
      (match) => match[1],
    );
    const hotelCells = source.slice(
      source.indexOf("{tab === 'hotels' ? (", source.indexOf('<tbody>')),
      source.indexOf(") : tab === 'chains' ? (", source.indexOf('<tbody>')),
    );
    const visibleCellCount = (hotelCells.match(/<td\b/g) ?? []).length + 3; // shared code + logo + actions cells

    expect(headers).toEqual([
      'کد',
      'لوگو',
      'هتل',
      'کشور / شهر / منطقه',
      'زنجیره',
      'درجه',
      'امکانات منتخب',
      'فروش‌پذیری',
      'وعده و سرویس',
      'نوع اتاق',
      'وب‌سایت',
      'ساعت ورود / خروج',
      'آدرس',
      'عملیات',
    ]);
    expect(visibleCellCount).toBe(headers.length);
    expect(source).toContain('{records.map((record) => (');
    expect(source).not.toContain('تأمین‌کننده HOTEL_PROVIDER');
    expect(source).toContain('<MasterDataProfileIdentity');
    expect(source).toContain('function profile()');

    const chainHeadersSource = source.slice(
      source.indexOf('? [', source.indexOf(": tab === 'chains'")),
      source.indexOf(": tab === 'meals'", source.indexOf(": tab === 'chains'")),
    );
    const chainHeaders = [...chainHeadersSource.matchAll(/'([^']+)'/g)].map(
      (match) => match[1],
    );
    const chainCells = source.slice(
      source.indexOf(") : tab === 'chains' ? (", source.indexOf('<tbody>')),
      source.indexOf(") : tab === 'meals' ? (", source.indexOf('<tbody>')),
    );
    expect(chainHeaders).toEqual([
      'کد',
      'لوگو',
      'نام فارسی',
      'نام انگلیسی',
      'کشور مبدأ',
      'وب‌سایت',
      'تعداد هتل عضو',
      'وضعیت',
      'عملیات',
    ]);
    expect((chainCells.match(/<td\b/g) ?? []).length + 3).toBe(
      chainHeaders.length,
    );
    expect(headers).not.toContain('آخرین تغییر');
    expect(chainHeaders).not.toContain('آخرین تغییر');
  });

  it('omits only the contract-reference column from composite hotel rows', () => {
    const combinedStart = source.indexOf('function combined()');
    const combinedEnd = source.indexOf('const content =', combinedStart);
    const combinedSource = source.slice(combinedStart, combinedEnd);
    const headerList = combinedSource.slice(
      combinedSource.indexOf('{['),
      combinedSource.indexOf('].map('),
    );
    const headers = [...headerList.matchAll(/'([^']+)'/g)].map(
      (match) => match[1],
    );
    const memberRow = combinedSource.slice(
      combinedSource.indexOf('<tr', combinedSource.indexOf('names.map')),
      combinedSource.indexOf('</tr>', combinedSource.indexOf('names.map')),
    );

    expect(headers).toEqual(['اولویت', 'هتل عضو', 'شهر / منطقه', 'وضعیت']);
    expect(memberRow.match(/<td\b/g)).toHaveLength(headers.length);
    expect(combinedSource).not.toContain('مرجع قرارداد');
    expect(combinedSource).not.toContain('— · Procurement');
    expect(combinedSource).toContain("attribute(record, 'usageCondition')");
    expect(catalogSource).toContain("key: 'usageCondition'");
  });

  it('labels the canonical meal service code without adding a duplicate cell', () => {
    const tableStart = source.indexOf('function table()');
    const mealsBranch = source.indexOf(": tab === 'meals'", tableStart);
    const mealsHeadersStart = source.indexOf('? [', mealsBranch);
    const mealsHeadersEnd = source.indexOf(': [', mealsHeadersStart);
    const headers = [
      ...source
        .slice(mealsHeadersStart, mealsHeadersEnd)
        .matchAll(/'([^']+)'/g),
    ].map((match) => match[1]);
    const mealsCells = source.slice(
      source.indexOf(") : tab === 'meals' ? (", source.indexOf('<tbody>')),
      source.indexOf(') : (', source.indexOf(") : tab === 'meals' ? (")),
    );
    const sharedRowPrefix = source.slice(
      source.indexOf('<tr', source.indexOf('{records.map((record) => (')),
      source.indexOf("{tab === 'hotels' ? (", source.indexOf('<tbody>')),
    );

    expect(headers).toEqual([
      'کد سرویس',
      'لوگو',
      'عنوان فارسی',
      'عنوان انگلیسی',
      'دسته',
      'وعده‌های شامل‌شده',
      'تعداد هتل مرتبط',
      'وضعیت',
      'عملیات',
    ]);
    expect((mealsCells.match(/<td\b/g) ?? []).length + 3).toBe(headers.length);
    expect(sharedRowPrefix.match(/<td\b/g)).toHaveLength(1);
    expect(sharedRowPrefix).toContain('{record.code}');
    expect(mealsCells).not.toContain('record.code');
    expect(headers.filter((header) => header === 'کد سرویس')).toHaveLength(1);
  });

  it('implements the catalog tabs and opens hotel profiles from the list', () => {
    for (const label of [
      'هتل‌ها',
      'زنجیره هتل',
      'وعده و سرویس',
      'امکانات',
      'ورود گروهی Excel',
      'هتل ترکیبی',
    ])
      expect(source).toContain(label);

    const tabs = source.slice(
      source.indexOf('const tabs'),
      source.indexOf('const copy'),
    );
    expect(tabs).not.toContain("id: 'hotel-profile'");
    expect(tabs).not.toContain("id: 'room-types'");
    expect(source).not.toContain("tab === 'room-types'");
    expect(source).toContain('<MasterDataProfileDialog');
    expect(source).toContain('setProfileOpen(true)');
  });

  it('keeps the hotel pricing header action white without changing the adjacent outline action', () => {
    const pricingHref = 'href="/master-data/accommodation/hotel-rates"';
    const pricingLinkStart = source.lastIndexOf(
      '<Link',
      source.indexOf(pricingHref),
    );
    const pricingLink = source.slice(
      pricingLinkStart,
      source.indexOf('</Link>', pricingLinkStart),
    );
    expect(pricingLink).toContain("buttonVariants({ variant: 'primary' })");
    expect(pricingLink).toContain('!text-white hover:!text-white');
    expect(pricingLink).toContain('قیمت‌گذاری هتل‌ها');

    const masterDataHref = 'href="/master-data"';
    const outlineLinkStart = source.lastIndexOf(
      '<Link',
      source.indexOf(masterDataHref, pricingLinkStart),
    );
    const outlineLink = source.slice(
      outlineLinkStart,
      source.indexOf('</Link>', outlineLinkStart),
    );
    expect(outlineLink).toContain("buttonVariants({ variant: 'outline' })");
    expect(outlineLink).toContain('همه بخش‌ها');
    expect(outlineLink).not.toContain('text-white');
  });

  it('keeps every accommodation KPI label identical to the mockup', () => {
    for (const label of [
      'کل هتل‌ها',
      'فروش‌پذیر',
      'کشورها / شهرها',
      'زنجیره غیرفعال',
      'کل زنجیره‌ها',
      'زنجیره فعال',
      'هتل‌های عضو',
      'کدهای سرویس',
      'Meal Plan',
      'سرویس‌ها',
      'کل امکانات',
      'امکان فعال',
      'دسته‌ها',
      'فاقد آیکن',
      'هتل‌های ترکیبی',
      'هتل عضو یکتا',
      'هتل ترکیبی غیرفعال',
    ])
      expect(source).toContain(label);
  });

  it('uses real backend/import contracts and no mockup domain fixtures', () => {
    expect(source).toContain('accommodationSummary');
    expect(source).toContain('<HotelImportPanel');
    expect(source).toContain('<MasterDataKpiGrid');
    expect(source).toContain("attribute(record, 'usageCondition')");
    expect(source).not.toContain('— · Procurement');
    expect(source).toContain('در انتظار اتصال Documents');
    expect(source).not.toContain('هتل اسپیناس پالاس');
    expect(source).not.toContain('CTR-881');
  });

  it('shows successfully imported rows in their destination hotel list', () => {
    expect(source).toContain(
      '<HotelImportPanel onImported={handleHotelImportCompleted} />',
    );
    const completionHandler = source.slice(
      source.indexOf('function handleHotelImportCompleted'),
      source.indexOf('async function persist'),
    );
    expect(completionHandler).toContain("setTab('hotels')");
    expect(completionHandler).toContain("setStatus('all')");
    expect(completionHandler).toContain('setCountryFilter(countryId)');
    expect(completionHandler).toContain('setCityFilter(cityId)');
    expect(completionHandler).toContain('resetColumnFilters()');
    expect(completionHandler).toContain('resetDateRange()');
    expect(completionHandler).toContain('فهرست مقصد نمایش داده شده است');
  });

  it('implements the contextual filters shown in every catalog mockup', () => {
    for (const label of ['همه کشورها', 'همه شهرها', 'همه درجات', 'همه دسته‌ها'])
      expect(source).toContain(label);
    expect(source).toContain('mealServiceCategory');
    expect(source).toContain('facilityCategory');
  });

  it('routes all hotel references through their canonical nested forms', () => {
    expect(liveFormSource).not.toContain("masterDataApi.create('room-types'");
    expect(liveFormSource).not.toContain('createHotelRoomType');
    expect(liveFormSource).toContain('alwaysShowCreate');
    expect(liveFormSource).toContain(
      "'mealServiceIds', 'roomTypeIds', 'facilityIds'",
    );
    expect(liveFormSource).toContain('definition: getMasterDataDefinition(');
    expect(referenceSelectorSource).toContain('افزودن نوع اتاق');
    expect(referenceSelectorSource).toContain('افزودن وعده/سرویس');
    expect(referenceSelectorSource).toContain('افزودن امکان');
  });
});
