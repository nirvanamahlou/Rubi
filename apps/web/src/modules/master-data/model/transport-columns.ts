import type { MasterDataRecord, MasterDataResource } from '@rubi/contracts';

export type TransportColumn = readonly [key: string, label: string];
export function transportColumns(
  resource: MasterDataResource,
): readonly TransportColumn[] {
  const operator: readonly TransportColumn[] = [
    ['countryName', 'کشور'],
    ['organizationName', 'سازمان'],
    ['logoFileReference', 'لوگو Reference'],
    ['integrationConnectionReference', 'Integration Connection'],
  ];
  switch (resource) {
    case 'airlines':
      return [
        ['code', 'IATA'],
        ['icaoCode', 'ICAO'],
        ['name', 'ایرلاین'],
        ...operator,
        ['versionAudit', 'Version / Audit'],
      ];
    case 'aircraft-types':
      return [
        ['code', 'کد'],
        ['manufacturer', 'سازنده'],
        ['model', 'مدل'],
        ['name', 'عنوان فارسی'],
        ['englishName', 'عنوان انگلیسی'],
        ['bodyType', 'نوع بدنه'],
        ['capacity', 'ظرفیت'],
      ];
    case 'cabin-classes':
      return [
        ['code', 'کد'],
        ['name', 'عنوان فارسی'],
        ['englishName', 'عنوان انگلیسی'],
        ['bookingCode', 'کد رزرو'],
        ['displayOrder', 'ترتیب'],
        ['usage', 'استفاده در Ticket Catalog'],
      ];
    case 'baggage-rules':
      return [
        ['airlineName', 'ایرلاین'],
        ['passengerType', 'نوع مسافر'],
        ['routeClass', 'مسیر / کلاس'],
        ['allowance', 'مقدار'],
        ['unit', 'واحد'],
        ['pieceCount', 'تعداد قطعه'],
        ['version', 'Version'],
      ];
    case 'manifest-templates':
      return [
        ['code', 'کد'],
        ['name', 'عنوان'],
        ['airlineName', 'ایرلاین'],
        ['versionNumber', 'نسخه قالب'],
        ['fileFormat', 'فرمت'],
        ['fileReferenceId', 'File Reference'],
        ['sheetName', 'Sheet'],
        ['headerRow', 'Header Row'],
        ['dateFormat', 'قالب تاریخ'],
        ['requiredColumns', 'ستون‌های الزامی'],
        ['columnOrder', 'ترتیب ستون‌ها'],
        ['validFrom', 'اعتبار از'],
        ['validTo', 'اعتبار تا'],
        ['publicationStatus', 'انتشار'],
      ];
    case 'rail-companies':
      return [
        ['code', 'کد'],
        ['name', 'شرکت ریلی'],
        ...operator,
        ['vehicleTypeCount', 'انواع قطار'],
        ['versionAudit', 'Version / Audit'],
      ];
    case 'bus-companies':
      return [
        ['code', 'کد'],
        ['name', 'شرکت اتوبوس'],
        ['countryName', 'کشور'],
        ['logoFileReference', 'لوگو Reference'],
        ['integrationConnectionReference', 'Integration Connection'],
        ['vehicleTypeCount', 'انواع اتوبوس'],
        ['versionAudit', 'Version / Audit'],
      ];
    case 'train-types':
      return [
        ['code', 'کد'],
        ['manufacturerModel', 'سازنده / مدل'],
        ['name', 'عنوان فارسی'],
        ['englishName', 'عنوان انگلیسی'],
        ['category', 'نوع'],
        ['facilityNames', 'امکانات مرجع'],
        ['capacity', 'ظرفیت'],
      ];
    case 'bus-types':
      return [
        ['code', 'کد'],
        ['manufacturerModel', 'سازنده / مدل'],
        ['name', 'عنوان فارسی'],
        ['englishName', 'عنوان انگلیسی'],
        ['serviceClass', 'نوع بدنه / کلاس'],
        ['facilityNames', 'امکانات مرجع'],
        ['capacity', 'ظرفیت'],
      ];
    default:
      return [
        ['code', 'کد'],
        ['name', 'عنوان'],
      ];
  }
}
const labels: Record<string, string> = {
  NARROW_BODY: 'باریک‌پیکر',
  WIDE_BODY: 'پهن‌پیکر',
  TURBOPROP: 'توربوپراپ',
  REGIONAL: 'منطقه‌ای',
  OTHER: 'سایر',
  SLEEPER: 'خواب',
  EXPRESS: 'سریع‌السیر',
  SALOON: 'سالنی',
  LUXURY: 'لوکس',
  STANDARD: 'استاندارد',
  DOMESTIC: 'داخلی',
  INTERNATIONAL: 'بین‌المللی',
  ALL: 'همه مسیرها',
  DRAFT: 'پیش‌نویس',
  ACTIVE: 'فعال',
  EXPIRED: 'منقضی',
};
export function transportColumnValue(
  record: MasterDataRecord,
  key: string,
): string {
  const value = (field: string) => {
    const raw = record.attributes[field];
    return raw === null || raw === undefined || raw === '' ? '—' : String(raw);
  };
  if (key === 'code') return record.code;
  if (key === 'name') return record.name;
  if (key === 'version') return `v${record.version}`;
  if (key === 'versionAudit')
    return `v${record.version} · ${new Date(record.updatedAt).toLocaleString('fa-IR')}`;
  if (key === 'capacity') return 'در پیکربندی ناوگان / سرویس';
  if (key === 'usage') return '— · در انتظار اتصال';
  if (key === 'routeClass')
    return `${labels[value('routeScope')] ?? value('routeScope')} / ${value('cabinClassName')}`;
  if (key === 'manufacturerModel')
    return `${value('manufacturer')} / ${value('model')}`;
  if (key === 'facilityNames')
    return value('facilityNames') === '—'
      ? value('amenities')
      : value('facilityNames');
  if (key === 'organizationName' && value(key) === '—')
    return value('supplierName');
  if (key === 'validFrom' || key === 'validTo')
    return value(key) === '—'
      ? '—'
      : new Date(value(key)).toLocaleDateString('fa-IR');
  return labels[value(key)] ?? value(key);
}
