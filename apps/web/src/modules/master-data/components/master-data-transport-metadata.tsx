import type {
  MasterDataRecord,
  MasterTransportFormResource,
} from '@rubi/contracts';

export function transportMetadata(
  resource: MasterTransportFormResource,
  record?: MasterDataRecord,
) {
  const entries: [string, string][] = [
    [
      resource === 'airlines' ? 'کد IATA' : 'کد مرجع',
      record?.code ??
        (resource === 'airlines'
          ? 'در فرم وارد می‌شود'
          : 'پس از ثبت، خودکار تولید می‌شود'),
    ],
    ['نسخه', record ? String(record.version) : 'پس از ثبت ایجاد می‌شود'],
    [
      'آخرین تغییر',
      record ? new Date(record.updatedAt).toLocaleString('fa-IR') : 'پس از ثبت',
    ],
  ];
  if (['airlines', 'rail-companies', 'bus-companies'].includes(resource)) {
    entries.push(
      [
        'لوگوی مرجع',
        record?.attributes.logoFileReference
          ? String(record.attributes.logoFileReference)
          : 'اتصال اسناد هنوز آماده نیست',
      ],
      ['اتصال سرویس', 'اتصال یکپارچه‌سازی هنوز آماده نیست'],
    );
  }
  if (resource === 'rail-companies' || resource === 'bus-companies')
    entries.push([
      resource === 'rail-companies' ? 'تعداد انواع قطار' : 'تعداد انواع اتوبوس',
      'در انتظار اطلاعات ناوگان',
    ]);
  if (['aircraft-types', 'train-types', 'bus-types'].includes(resource))
    entries.push(['ظرفیت', 'در پیکربندی ناوگان یا سرویس تعیین می‌شود']);
  if (resource === 'train-types' && record?.attributes.amenities)
    entries.push([
      'امکانات ثبت‌شدهٔ قبلی',
      String(record.attributes.amenities),
    ]);
  return entries;
}

export function MasterDataTransportMetadata(props: {
  resource: MasterTransportFormResource;
  record?: MasterDataRecord;
}) {
  return (
    <dl
      aria-label="مشخصات فقط‌خواندنی"
      className="grid gap-4 rounded-2xl bg-sky-50/70 p-4 text-sm dark:bg-sky-950/20 sm:grid-cols-2"
    >
      {transportMetadata(props.resource, props.record).map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-1 break-words font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
