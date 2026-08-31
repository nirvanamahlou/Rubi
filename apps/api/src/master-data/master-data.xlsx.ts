import type { MasterDataRecord, MasterDataResource } from '@rubi/contracts';
import { strToU8, zipSync } from 'fflate';

export const MASTER_DATA_XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const columnLabels: Readonly<Record<string, string>> = {
  code: 'کد سیستمی',
  name: 'عنوان',
  englishName: 'عنوان انگلیسی',
  countryId: 'کشور',
  regionId: 'استان/ناحیه',
  parentRegionId: 'ناحیه بالادستی',
  iataCode: 'کد IATA',
  ianaTimezone: 'منطقه زمانی IANA',
  latitude: 'عرض جغرافیایی',
  longitude: 'طول جغرافیایی',
  airportId: 'فرودگاه',
  terminalType: 'نوع ترمینال',
  gateCount: 'تعداد گیت',
  operatingHoursMode: 'نوع ساعت فعالیت',
  opensAt: 'شروع فعالیت',
  closesAt: 'پایان فعالیت',
  symbol: 'نماد',
  decimalDigits: 'تعداد اعشار',
  fromCurrencyCode: 'ارز مبدأ',
  toCurrencyCode: 'ارز مقصد',
  rate: 'نرخ',
  rateType: 'نوع نرخ',
  source: 'منبع',
  observedAt: 'زمان مشاهده',
  validFrom: 'شروع اعتبار',
  validTo: 'پایان اعتبار',
  correctionReason: 'دلیل اصلاح',
  organizationId: 'سازمان',
  icaoCode: 'کد ICAO',
  manufacturer: 'سازنده',
  model: 'مدل',
  bodyType: 'نوع بدنه',
  bookingCode: 'کد رزرو',
  cabinType: 'کابین',
  airlineId: 'ایرلاین',
  cabinClassId: 'کلاس پروازی',
  passengerType: 'نوع مسافر',
  routeScope: 'دامنه مسیر',
  allowance: 'میزان بار',
  unit: 'واحد',
  pieceCount: 'تعداد قطعه',
  versionNumber: 'نسخه قالب',
  fileFormat: 'فرمت فایل',
  fileReferenceId: 'مرجع سند',
  sheetName: 'نام Sheet',
  headerRow: 'ردیف عنوان',
  dateFormat: 'قالب تاریخ',
  requiredColumns: 'ستون‌های الزامی',
  columnOrder: 'ترتیب ستون‌ها',
  publicationStatus: 'وضعیت انتشار',
  serviceClass: 'کلاس خدمات',
  amenities: 'امکانات',
  colorHex: 'رنگ',
  cityId: 'شهر',
  starRating: 'درجه هتل',
  chainId: 'زنجیره هتل',
  website: 'وب‌سایت',
  address: 'آدرس',
  checkInTime: 'ساعت ورود',
  checkOutTime: 'ساعت خروج',
  isSaleableReference: 'فروش‌پذیر',
  referenceCapacity: 'ظرفیت استاندارد',
  usageDescription: 'توضیح استفاده',
  category: 'دسته',
  includedMeals: 'وعده‌های شامل‌شده',
  displayOrder: 'ترتیب نمایش',
  usageCondition: 'شرط استفاده',
  memberHotelIds: 'هتل‌های عضو',
  legalName: 'نام ثبتی',
  displayName: 'نام نمایشی',
  roleCodes: 'نقش‌ها',
  collaborationStatus: 'وضعیت همکاری',
  externalProviderReference: 'شناسه عمومی Provider',
  serviceCodes: 'خدمات',
  fullName: 'نام مخاطب',
  jobTitle: 'سمت',
  preferredChannel: 'کانال ترجیحی',
  phoneMasked: 'تلفن ماسک‌شده',
  emailMasked: 'ایمیل ماسک‌شده',
  languages: 'زبان‌ها',
  expertise: 'تخصص',
  destinations: 'مقصدها',
  primaryPhoneMasked: 'تلفن اصلی ماسک‌شده',
  roamingPhoneMasked: 'تلفن رومینگ ماسک‌شده',
  welcomeSignCode: 'کد تابلو استقبال',
  operationalNotes: 'توضیحات اجرایی',
  scope: 'دامنه',
  vehicleType: 'نوع وسیله',
  serviceMode: 'شیوه سرویس',
  suggestedCapacity: 'ظرفیت پیشنهادی',
  supplierId: 'Provider',
  facilityIds: 'امکانات مرجع',
  passengerScope: 'نوع مسافر',
  includedItems: 'اقلام شامل‌شده',
  visaType: 'نوع ویزا',
  referenceValidityDays: 'مدت اعتبار مرجع',
  guidanceFileReference: 'Reference راهنما',
  insurerId: 'بیمه‌گر',
  destinationRegion: 'مقصد یا منطقه',
  minimumAge: 'حداقل سن',
  maximumAge: 'حداکثر سن',
  coverageIds: 'پوشش‌ها',
  coverageLimit: 'سقف تعهد',
  deductibleAmount: 'فرانشیز',
  currencyId: 'ارز',
  description: 'توضیحات',
  status: 'وضعیت',
  transportStatus: 'وضعیت بررسی',
  updatedAt: 'آخرین تغییر',
};

const resourceLabels: Record<MasterDataResource, string> = {
  countries: 'کشورها',
  regions: 'استان‌ها و نواحی',
  cities: 'شهرها',
  airports: 'فرودگاه‌ها',
  terminals: 'ترمینال‌ها',
  currencies: 'ارزها',
  'exchange-rates': 'نرخ ارز',
  banks: 'بانک‌ها',
  'bank-branches': 'شعب بانک',
  'payment-methods': 'روش‌های پرداخت',
  insurers: 'شرکت‌های بیمه',
  'insurance-plans': 'طرح‌های بیمه',
  'insurance-coverages': 'پوشش‌های بیمه',
  airlines: 'ایرلاین‌ها',
  'aircraft-types': 'انواع هواپیما',
  'cabin-classes': 'کلاس‌های پروازی',
  'baggage-rules': 'قواعد بار',
  'manifest-templates': 'قالب‌های Manifest',
  'rail-companies': 'شرکت‌های ریلی',
  'train-types': 'انواع قطار',
  'bus-companies': 'شرکت‌های اتوبوس',
  'bus-types': 'انواع اتوبوس',
  hotels: 'هتل‌ها',
  'hotel-chains': 'زنجیره‌های هتل',
  'room-types': 'نوع‌های اتاق',
  'meal-services': 'وعده و سرویس',
  facilities: 'امکانات هتل',
  'composite-hotels': 'هتل‌های ترکیبی',
  organizations: 'سازمان‌ها',
  suppliers: 'تأمین‌کنندگان',
  brokers: 'کارگزاران',
  'travel-services': 'خدمات سفر مرجع',
  'organization-contacts': 'مخاطبان سازمانی',
  leaders: 'لیدرها',
  'tour-types': 'انواع تور',
  'transfer-types': 'انواع ترانسفر',
  'cip-services': 'خدمات CIP',
  'visa-services': 'خدمات ویزا',
  'acquaintance-methods': 'نحوه آشنایی',
  'lead-sources': 'منابع سرنخ',
  'sales-channels': 'کانال‌های فروش',
  'lost-reasons': 'دلایل از دست رفتن',
  'customer-types': 'انواع مشتری',
  tags: 'Tagها',
  'campaign-types': 'انواع کمپین',
};

function escapeXml(value: unknown): string {
  return Array.from(String(value ?? '').normalize('NFKC'))
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return (
        codePoint === 0x09 ||
        codePoint === 0x0a ||
        codePoint === 0x0d ||
        codePoint >= 0x20
      );
    })
    .join('')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnName(index: number): string {
  let value = index + 1;
  let name = '';
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

function cell(reference: string, value: unknown, style = 0): string {
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function recordValue(
  record: MasterDataRecord,
  column: string,
  formatter: Intl.DateTimeFormat,
): string | number {
  if (column === 'code') return record.code;
  if (column === 'name') return record.name;
  if (column === 'status')
    return record.resource === 'meal-services' && record.attributes.isUnderReview === true
      ? 'در حال بررسی'
      : record.status === 'active' ? 'فعال' : 'غیرفعال';
  if (column === 'transportStatus') {
    const status = record.attributes.transportStatus;
    return status === 'UNDER_REVIEW' ? 'در حال بررسی' : status === 'ACTIVE' ? 'فعال' : 'غیرفعال';
  }
  if (column === 'updatedAt')
    return formatter.format(new Date(record.updatedAt));
  const value = record.attributes[column];
  if (typeof value === 'boolean') return value ? 'بله' : 'خیر';
  return value ?? '';
}

export function buildMasterDataXlsx(input: {
  resource: MasterDataResource;
  columns: readonly string[];
  records: readonly MasterDataRecord[];
  locale: 'fa-IR';
  timezone: string;
}): Uint8Array {
  const formatter = new Intl.DateTimeFormat(input.locale, {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: input.timezone,
  });
  const header = input.columns
    .map((column, index) =>
      cell(`${columnName(index)}1`, columnLabels[column] ?? column, 1),
    )
    .join('');
  const dataRows = input.records
    .map((record, rowIndex) => {
      const rowNumber = rowIndex + 2;
      const cells = input.columns
        .map((column, columnIndex) =>
          cell(
            `${columnName(columnIndex)}${rowNumber}`,
            recordValue(record, column, formatter),
          ),
        )
        .join('');
      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join('');
  const lastColumn = columnName(Math.max(0, input.columns.length - 1));
  const lastRow = Math.max(1, input.records.length + 1);
  const range = `A1:${lastColumn}${lastRow}`;
  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0" rightToLeft="1"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <dimension ref="${range}"/>
  <sheetData><row r="1">${header}</row>${dataRows}</sheetData>
  <autoFilter ref="${range}"/>
</worksheet>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${escapeXml(resourceLabels[input.resource])}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
  <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1D4ED8"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  const files = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': workbook,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': worksheet,
    'xl/styles.xml': styles,
  };
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([name, content]) => [name, strToU8(content)]),
    ),
    { level: 6 },
  );
}
