'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/form-controls';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { DatePicker } from '@/components/ui/date-picker';
import { Alert, Badge, Card, Skeleton } from '@/components/ui/surfaces';
import {
  integrationsApi,
  type EditorContract,
  type EditorSchema,
} from '../api/client';
import {
  catalogueChanges,
  decimalField,
  initialValue,
  normaliseValue,
  nullable,
  resolveSchema,
} from '../catalogue-form-model';

const resources = {
  tours: 'تورها',
  hotels: 'هتل‌ها',
  'service-offers': 'بلیت و خدمات',
  visas: 'ویزاها',
  destinations: 'مقصدها',
  countries: 'کشورها',
  airlines: 'شرکت‌های هواپیمایی',
  categories: 'دسته‌بندی تور',
  'editorial-content': 'محتوای سایت',
};
const labels: Record<string, string> = {
  title: 'عنوان',
  name: 'نام',
  slug: 'شناسه لاتین در نشانی سایت',
  summary: 'خلاصه معرفی',
  description: 'توضیحات کامل',
  status: 'وضعیت',
  origin: 'مبدأ',
  destination: 'مقصد',
  destination_id: 'مقصد',
  country_id: 'کشور',
  country: 'کشور',
  category_id: 'دسته‌بندی',
  airline_id: 'شرکت هواپیمایی',
  airline_name: 'نام شرکت هواپیمایی',
  hotel_id: 'هتل',
  hotel_ids: 'هتل‌های تور',
  city: 'شهر',
  region: 'منطقه',
  address: 'نشانی',
  departures: 'تاریخ‌های حرکت، پرواز و ظرفیت',
  itinerary: 'برنامه روزانه سفر',
  media: 'رسانه‌ها',
  hotel_package_prices: 'قیمت اتاق‌ها و ترکیب هتل‌های تور',
  price_periods: 'بازه‌های قیمت هتل',
  start_date: 'تاریخ شروع',
  end_date: 'تاریخ پایان',
  booking_deadline: 'آخرین مهلت رزرو',
  capacity: 'ظرفیت',
  duration_days: 'مدت سفر (روز)',
  rating: 'امتیاز',
  transportation: 'روش حمل‌ونقل',
  price_amount: 'قیمت',
  currency: 'ارز',
  flight_price_amount: 'قیمت پرواز',
  flight_price_currency: 'ارز پرواز',
  adult_price_amount: 'قیمت بزرگسال',
  double_price_amount: 'قیمت دوتخته',
  single_price_amount: 'قیمت یک‌تخته',
  child_with_bed_price_amount: 'قیمت کودک با تخت',
  child_without_bed_price_amount: 'قیمت کودک بدون تخت',
  infant_price_amount: 'قیمت نوزاد',
  min_price_amount: 'حداقل قیمت',
  max_price_amount: 'حداکثر قیمت',
  local_price_amount: 'قیمت بخش داخلی',
  local_currency: 'ارز بخش داخلی',
  local_adult_price_amount: 'قیمت داخلی بزرگسال',
  local_double_price_amount: 'قیمت داخلی دوتخته',
  local_single_price_amount: 'قیمت داخلی یک‌تخته',
  local_child_with_bed_price_amount: 'قیمت داخلی کودک با تخت',
  local_child_without_bed_price_amount: 'قیمت داخلی کودک بدون تخت',
  local_infant_price_amount: 'قیمت داخلی نوزاد',
  single_price_currency: 'ارز یک‌تخته',
  double_price_currency: 'ارز دوتخته',
  child_with_bed_price_currency: 'ارز کودک با تخت',
  child_without_bed_price_currency: 'ارز کودک بدون تخت',
  infant_price_currency: 'ارز نوزاد',
  room_type: 'نوع اتاق',
  board_basis: 'خدمات غذایی',
  default_room_type: 'نوع اتاق پیش‌فرض',
  service_class: 'کلاس خدمات',
  service_label: 'عنوان خدمات',
  service_type: 'نوع خدمت',
  stars: 'تعداد ستاره',
  facilities: 'امکانات',
  image_url: 'نشانی تصویر',
  image_alt: 'متن جایگزین تصویر',
  hero_image_url: 'تصویر اصلی',
  hero_image_alt: 'متن جایگزین تصویر اصلی',
  gallery_urls: 'نشانی تصاویر گالری',
  url: 'نشانی فایل',
  alt: 'متن جایگزین',
  kind: 'نوع',
  caption: 'شرح تصویر',
  sort_order: 'ترتیب نمایش',
  included_services: 'خدمات شامل تور',
  required_documents: 'مدارک لازم',
  important_notes: 'نکات مهم',
  refund_policy: 'قوانین استرداد',
  hotel_rules: 'قوانین هتل',
  notes: 'یادداشت داخلی',
  is_featured: 'نمایش ویژه',
  is_best_seller: 'پرفروش',
  installment_available: 'خرید اقساطی',
  is_group: 'تور گروهی',
  ticket_included: 'بلیت در پکیج لحاظ شده',
  transfer_included: 'ترانسفر لحاظ شده',
  origin_airport_code: 'کد فرودگاه مبدأ',
  destination_airport_code: 'کد فرودگاه مقصد',
  airport_code: 'کد فرودگاه',
  code: 'کد',
  logo_url: 'نشانی لوگو',
  flag_url: 'نشانی پرچم',
  departure_time: 'ساعت حرکت',
  arrival_time: 'ساعت رسیدن',
  return_departure_time: 'ساعت حرکت برگشت',
  return_arrival_time: 'ساعت رسیدن برگشت',
  outbound_flight_number: 'شماره پرواز رفت',
  outbound_departure_time: 'ساعت پرواز رفت',
  outbound_arrival_time: 'ساعت رسیدن رفت',
  return_flight_number: 'شماره پرواز برگشت',
  day_number: 'شماره روز',
  event_type: 'نوع برنامه',
  location: 'محل',
  event_date: 'تاریخ برنامه',
  event_time: 'ساعت برنامه',
  duration_minutes: 'مدت (دقیقه)',
  stay_days: 'روزهای اقامت',
  transport_type: 'نوع وسیله',
  baggage_allowance_kg: 'بار مجاز (کیلوگرم)',
  external_id: 'شناسه خارجی پایدار',
  price_set_id: 'شناسه مجموعه قیمت',
  is_base_hotel: 'هتل پایه',
  combination_id: 'شناسه ترکیب',
  combination_label: 'عنوان ترکیب',
  combined_hotel_ids: 'هتل‌های ترکیب',
  unavailable_hotel_ids: 'هتل‌های غیرقابل رزرو',
  combination_flight_prices: 'قیمت پرواز ترکیب',
  itinerary_time_overrides: 'زمان‌بندی اختصاصی برنامه سفر',
  flight_per_person_amount: 'هزینه پرواز هر نفر',
  flight_currency: 'ارز پرواز',
  flight_child_with_bed_amount: 'پرواز کودک با تخت',
  flight_child_without_bed_amount: 'پرواز کودک بدون تخت',
  flight_applies_to: 'گروه‌های مشمول هزینه پرواز',
  provider_name: 'تأمین‌کننده',
  provider_logo_url: 'لوگوی تأمین‌کننده',
  provider_gallery_urls: 'گالری تأمین‌کننده',
  train_company: 'شرکت ریلی',
  trip_type: 'نوع مسیر',
  vehicle_name: 'نوع وسیله',
  return_price_amount: 'قیمت برگشت',
  content_type: 'نوع محتوا',
  body: 'متن محتوا',
  published_at: 'زمان انتشار',
  latitude: 'عرض جغرافیایی',
  longitude: 'طول جغرافیایی',
  map_search_query: 'عبارت جست‌وجوی نقشه',
  availability: 'وضعیت دسترسی',
  pricing_source_sheet: 'شیت منبع قیمت',
  commission_amount: 'کمیسیون',
};
const enums: Record<string, string> = {
  draft: 'پیش‌نویس',
  published: 'منتشرشده',
  available: 'قابل رزرو',
  full: 'تکمیل ظرفیت',
  cancelled: 'لغوشده',
  'one-way': 'یک‌طرفه',
  'round-trip': 'رفت‌وبرگشت',
  flight: 'پرواز',
  train: 'قطار',
  image: 'تصویر',
  video: 'ویدئو',
  economy: 'اقتصادی',
  business: 'تجاری',
  standard: 'استاندارد',
  luxury: 'لوکس',
};
type Lookup = Record<string, { id: string; title: string }[]>;

function SchemaField({
  name,
  node,
  root,
  value,
  onChange,
  contract,
  lookup,
  disabled,
  depth = 0,
}: {
  name: string;
  node: EditorSchema;
  root: EditorSchema;
  value: unknown;
  onChange: (value: unknown) => void;
  contract: EditorContract;
  lookup: Lookup;
  disabled: boolean;
  depth?: number;
}) {
  const s = resolveSchema(node, root);
  const label = labels[name] ?? s.title ?? name.replaceAll('_', ' ');
  if (depth > 10) return <p>ساختار تو در تو بیش از حد مجاز است.</p>;
  const ref = contract.lookups[name];
  if (s.type === 'array') {
    const values = Array.isArray(value) ? value : [];
    const item = s.items ?? {};
    return (
      <fieldset className="grid gap-3 rounded-xl border border-border p-4 sm:col-span-2">
        <legend className="px-2 font-semibold">
          {label} ({values.length.toLocaleString('fa-IR')})
        </legend>
        {values.map((v, i) => (
          <div
            className="grid gap-2 rounded-lg border border-border p-3"
            key={i}
          >
            {ref ? (
              <LookupField
                value={v}
                items={lookup[ref] ?? []}
                disabled={disabled}
                label={label}
                onChange={(next) =>
                  onChange(values.map((old, at) => (at === i ? next : old)))
                }
              />
            ) : (
              <SchemaField
                name={
                  resolveSchema(item, root).type === 'object'
                    ? String(i + 1)
                    : name
                }
                node={item}
                root={root}
                value={v}
                onChange={(next) =>
                  onChange(values.map((old, at) => (at === i ? next : old)))
                }
                contract={contract}
                lookup={lookup}
                disabled={disabled}
                depth={depth + 1}
              />
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => onChange(values.filter((_, at) => at !== i))}
            >
              حذف این ردیف از فرم
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          disabled={disabled || values.length >= 100}
          onClick={() =>
            onChange([
              ...values,
              initialValue(item, root) ??
                (resolveSchema(item, root).type === 'object' ? {} : ''),
            ])
          }
        >
          افزودن ردیف
        </Button>
      </fieldset>
    );
  }
  if (s.type === 'object' || s.properties) {
    const object =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    return (
      <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
        {Object.entries(s.properties ?? {}).map(([key, child]) => (
          <SchemaField
            key={key}
            name={key}
            node={child}
            root={root}
            value={object[key]}
            onChange={(next) => onChange({ ...object, [key]: next })}
            contract={contract}
            lookup={lookup}
            disabled={disabled}
            depth={depth + 1}
          />
        ))}
      </div>
    );
  }
  let control;
  if (ref)
    control = (
      <LookupField
        value={value}
        items={lookup[ref] ?? []}
        label={label}
        disabled={disabled}
        onChange={onChange}
      />
    );
  else if (s.enum)
    control = (
      <NativeSearchSelect
        aria-label={label}
        value={String(value ?? '')}
        disabled={disabled}
        onChange={(e) =>
          onChange(e.target.value || (nullable(node) ? null : undefined))
        }
      >
        <option value="">انتخاب کنید</option>
        {s.enum
          .filter(
            (v) =>
              name !== 'status' ||
              v !== 'published' ||
              contract.canPublish ||
              value === 'published',
          )
          .map((v) => (
            <option key={String(v)} value={String(v)}>
              {enums[String(v)] ?? String(v)}
            </option>
          ))}
      </NativeSearchSelect>
    );
  else if (s.type === 'boolean')
    control = (
      <NativeSearchSelect
        aria-label={label}
        value={value === true ? 'true' : value === false ? 'false' : ''}
        disabled={disabled}
        onChange={(e) =>
          onChange(e.target.value === '' ? null : e.target.value === 'true')
        }
      >
        <option value="">تعیین نشده</option>
        <option value="true">بله</option>
        <option value="false">خیر</option>
      </NativeSearchSelect>
    );
  else if (s.format === 'date')
    control = (
      <DatePicker
        aria-label={label}
        value={typeof value === 'string' ? value : ''}
        disabled={disabled}
        onChange={(v) => onChange(v || (nullable(node) ? null : undefined))}
      />
    );
  else if (
    [
      'description',
      'summary',
      'notes',
      'body',
      'refund_policy',
      'hotel_rules',
    ].includes(name)
  )
    control = (
      <Textarea
        aria-label={label}
        value={String(value ?? '')}
        disabled={disabled}
        maxLength={s.maxLength}
        onChange={(e) =>
          onChange(e.target.value || (nullable(node) ? null : ''))
        }
      />
    );
  else
    control = (
      <Input
        aria-label={label}
        disabled={disabled}
        type={
          s.format === 'time'
            ? 'time'
            : s.type === 'integer'
              ? 'number'
              : 'text'
        }
        inputMode={decimalField(node) ? 'decimal' : undefined}
        value={String(value ?? '')}
        min={s.minimum}
        max={s.maximum}
        maxLength={s.maxLength}
        onChange={(e) =>
          onChange(
            e.target.value === ''
              ? nullable(node)
                ? null
                : undefined
              : s.type === 'integer'
                ? Number(e.target.value)
                : e.target.value,
          )
        }
      />
    );
  return (
    <label className="grid gap-2 text-sm">
      <span>{label}</span>
      {control}
      {s.description ? (
        <span className="text-xs text-muted-foreground">{s.description}</span>
      ) : null}
    </label>
  );
}
function LookupField({
  value,
  items,
  label,
  disabled,
  onChange,
}: {
  value: unknown;
  items: { id: string; title: string }[];
  label: string;
  disabled: boolean;
  onChange: (value: unknown) => void;
}) {
  return (
    <NativeSearchSelect
      aria-label={label}
      value={String(value ?? '')}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">انتخاب کنید</option>
      {value !== null &&
      value !== undefined &&
      !items.some((i) => i.id === String(value)) ? (
        <option value={String(value)}>
          شناسه {String(value)} (مقدار فعلی)
        </option>
      ) : null}
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.title} · {item.id}
        </option>
      ))}
    </NativeSearchSelect>
  );
}

export function NiyayeshEditor({
  branchId,
  onSaved,
}: {
  branchId: string;
  onSaved: () => void;
}) {
  const [resource, setResource] = useState('tours');
  const [id, setId] = useState('');
  const [records, setRecords] = useState<{ id: string; title: string }[]>([]);
  const [next, setNext] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [contract, setContract] = useState<EditorContract | null>(null);
  const [value, setValue] = useState<Record<string, unknown>>({});
  const [original, setOriginal] = useState<Record<string, unknown> | null>(
    null,
  );
  const [lookup, setLookup] = useState<Lookup>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [command, setCommand] = useState('');
  useEffect(() => {
    const control = new AbortController();
    void (async () => {
      setBusy(true);
      setError('');
      setContract(null);
      try {
        const loaded = await integrationsApi.niyayeshEditor(
          branchId,
          resource,
          id || undefined,
          control.signal,
        );
        const start = (
          loaded.record
            ? normaliseValue(
                loaded.createSchema,
                loaded.createSchema,
                loaded.record.value,
              )
            : initialValue(loaded.createSchema, loaded.createSchema)
        ) as Record<string, unknown>;
        if (control.signal.aborted) return;
        setContract(loaded);
        setValue(start);
        setOriginal(loaded.record ? start : null);
        setCommand(crypto.randomUUID());
        const fields = JSON.stringify(loaded.createSchema);
        const references = [
          ...new Set(
            Object.entries(loaded.lookups)
              .filter(([key]) => fields.includes(`"${key}"`))
              .map(([, target]) => target),
          ),
        ];
        const result: Lookup = {};
        for (const target of references) {
          result[target] = [];
          let after = 0;
          for (let page = 0; page < 200; page++) {
            try {
              const data = await integrationsApi.niyayeshResources(
                branchId,
                target,
                after,
                control.signal,
              );
              result[target].push(
                ...data.items
                  .filter((row) => !row.archived)
                  .map((row) => ({
                    id: row.externalId,
                    title: String(
                      row.data?.name ?? row.data?.title ?? row.externalId,
                    ),
                  })),
              );
              if (!data.hasMore) break;
              after = data.nextId;
            } catch {
              break;
            }
          }
        }
        if (!control.signal.aborted) setLookup(result);
      } catch (e) {
        if (!control.signal.aborted)
          setError(e instanceof Error ? e.message : 'دریافت فرم انجام نشد.');
      } finally {
        if (!control.signal.aborted) setBusy(false);
      }
    })();
    return () => control.abort();
  }, [branchId, resource, id, revision]);
  useEffect(() => {
    const control = new AbortController();
    void integrationsApi
      .niyayeshResources(branchId, resource, next, control.signal)
      .then((page) => {
        setRecords((old) => [
          ...(next ? old : []),
          ...page.items
            .filter((i) => !i.archived)
            .map((i) => ({
              id: i.externalId,
              title: String(i.data?.title ?? i.data?.name ?? i.externalId),
            })),
        ]);
        setHasMore(page.hasMore);
        setCursor(page.nextId);
      })
      .catch(() => {});
    return () => control.abort();
  }, [branchId, resource, next, revision]);
  async function save() {
    if (!contract) return;
    const payload = catalogueChanges(value, original);
    if (id && !Object.keys(payload).length) {
      setNotice('تغییری در فرم وجود ندارد.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const saved = await integrationsApi.niyayeshSave(
        branchId,
        resource,
        payload,
        command,
        contract.record ?? undefined,
      );
      setNotice('اطلاعات در سایت نیایش ثبت شد.');
      onSaved();
      setId(String(saved.id));
      setRevision((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت در سایت انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  const grouped = new Set(Object.values(contract?.groups ?? {}).flat());
  const groups: Record<string, string[]> = contract
    ? {
        ...contract.groups,
        'سایر مشخصات': Object.keys(
          contract.createSchema.properties ?? {},
        ).filter((k) => !grouped.has(k)),
      }
    : {};
  return (
    <Card className="grid gap-5 p-5">
      <div>
        <h3 className="text-lg font-bold">تعریف و ویرایش اطلاعات سایت</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          فرم کامل از قرارداد واقعی نیایش دریافت می‌شود. ثبت و اعتبارسنجی روی
          همان سایت انجام می‌شود؛ اطلاعات موجود با نسخهٔ جدیدتر جایگزین
          نمی‌شوند.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm">
          بخش سایت
          <NativeSearchSelect
            value={resource}
            disabled={busy}
            onChange={(e) => {
              setResource(e.target.value);
              setId('');
              setRecords([]);
              setNext(0);
              setNotice('');
            }}
          >
            {Object.entries(resources).map(([key, title]) => (
              <option key={key} value={key}>
                {title}
              </option>
            ))}
          </NativeSearchSelect>
        </label>
        <label className="grid gap-2 text-sm">
          رکورد سایت
          <NativeSearchSelect
            value={id}
            disabled={busy}
            onChange={(e) => {
              setId(e.target.value);
              setNotice('');
            }}
          >
            <option value="">تعریف جدید</option>
            {records.map((row) => (
              <option key={row.id} value={row.id}>
                {row.title} · {row.id}
              </option>
            ))}
          </NativeSearchSelect>
          {hasMore ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setNext(cursor)}
            >
              دریافت موارد بیشتر
            </Button>
          ) : null}
        </label>
      </div>
      {error ? (
        <Alert tone="error" title="عملیات انجام نشد" description={error} />
      ) : null}
      {notice ? <Alert title={notice} /> : null}
      {busy && !contract ? <Skeleton className="h-28" /> : null}
      {contract ? (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Badge className="w-fit">
            {id
              ? `ویرایش ${contract.title} · ${id}`
              : `تعریف ${contract.title} جدید`}
          </Badge>
          {Object.entries(groups).map(([group, fields], index) => {
            const visible = fields.filter(
              (key) => contract.createSchema.properties?.[key],
            );
            if (!visible.length) return null;
            return (
              <details
                key={group}
                className="rounded-xl border border-border p-4"
                open={index === 0}
              >
                <summary className="cursor-pointer font-bold">{group}</summary>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {visible.map((key) => (
                    <div
                      key={key}
                      className={
                        resolveSchema(
                          contract.createSchema.properties![key]!,
                          contract.createSchema,
                        ).type === 'array'
                          ? 'sm:col-span-2'
                          : ''
                      }
                    >
                      <SchemaField
                        name={key}
                        node={contract.createSchema.properties![key]!}
                        root={contract.createSchema}
                        value={value[key]}
                        onChange={(nextValue) => {
                          setValue((old) => ({ ...old, [key]: nextValue }));
                          setCommand(crypto.randomUUID());
                          setNotice('');
                        }}
                        contract={contract}
                        lookup={lookup}
                        disabled={
                          busy ||
                          (id ? !contract.canUpdate : !contract.canCreate)
                        }
                      />
                      {contract.createSchema.required?.includes(key) ? (
                        <span className="text-xs text-muted-foreground">
                          الزامی برای تعریف جدید
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              disabled={
                busy || (id ? !contract.canUpdate : !contract.canCreate)
              }
            >
              {busy ? 'در حال ثبت…' : 'ثبت در سایت نیایش'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setRevision((v) => v + 1)}
            >
              دریافت آخرین نسخه از سایت
            </Button>
          </div>
          {!contract.canPublish ? (
            <p className="text-sm text-muted-foreground">
              انتشار جدید به مجوز انتشار سایت نیاز دارد؛ ویرایش مشخصات، مجوز
              انتشار ایجاد نمی‌کند.
            </p>
          ) : null}
        </form>
      ) : null}
    </Card>
  );
}
