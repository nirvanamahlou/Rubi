'use client';
import { useState } from 'react';
import type {
  BranchReference,
  DocumentOptionsResponseV1,
  MasterDataRecord,
  TourPackageInputV1,
} from '@rubi/contracts';
import {
  Button,
  FormField,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui';
import { DocumentUploadDialog } from '@/modules/documents/components/document-upload-dialog';
import { documentsApi } from '@/modules/documents/api/client';

type Details = NonNullable<TourPackageInputV1['details']>;
type Step = NonNullable<Details['itinerary']>[number];
const prose = [
  ['summary', 'خلاصه تور'],
  ['description', 'معرفی و توضیحات کلی تور'],
  ['requiredDocuments', 'مدارک لازم تور'],
  ['services', 'خدمات تور'],
  ['installmentTerms', 'شرایط اقساط'],
  ['refundRules', 'قوانین استرداد تور'],
] as const;
const kinds = [
  ['START', 'شروع تور'],
  ['TRANSPORT', 'پرواز یا جابه‌جایی'],
  ['TRANSIT', 'توقف یا ترانزیت'],
  ['STAY', 'مقصد و اقامت'],
  ['EVENT', 'برنامه و رویداد'],
  ['END', 'پایان سفر'],
] as const;

function Menu({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: string;
  choices: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  return (
    <FormField label={label}>
      <Select
        value={value || 'none'}
        onValueChange={(v) => onChange(v === 'none' ? '' : v)}
      >
        <SelectTrigger aria-label={label}>
          <SelectValue placeholder="انتخاب کنید" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">انتخاب نشده</SelectItem>
          {choices.map(([id, name]) => (
            <SelectItem key={id} value={id}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

export function TourDetailsForm({
  value = { version: 1 },
  onChange,
  currencies,
  airlines,
  airports,
  branches,
  branchId,
}: {
  value?: Details;
  onChange: (value: Details) => void;
  currencies: MasterDataRecord[];
  airlines: MasterDataRecord[];
  airports: MasterDataRecord[];
  branches: BranchReference[];
  branchId: string;
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [options, setOptions] = useState<
    DocumentOptionsResponseV1['data'] | null
  >(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState('');
  const [pendingImage, setPendingImage] = useState('');
  const [imageName, setImageName] = useState('');
  function patch(key: keyof Details, item: unknown) {
    const next = { ...value, [key]: item };
    if (item === '' || item === undefined) delete next[key];
    onChange(next);
  }
  function stepPatch(index: number, key: keyof Step, item: unknown) {
    const steps = [...(value.itinerary ?? [])];
    const next = { ...steps[index], [key]: item };
    if (item === '' || item === undefined) delete next[key];
    steps[index] = next;
    patch('itinerary', steps);
  }
  async function checkImage(id: string) {
    const { data } = await documentsApi.detail(id);
    if (
      data.type.domain !== 'BRAND' ||
      data.branchId !== branchId ||
      data.archiveStatus !== 'ACTIVE' ||
      data.requiresStepUpVerification ||
      !['PUBLIC', 'INTERNAL'].includes(data.confidentiality) ||
      !['image/png', 'image/jpeg'].includes(
        data.currentVersion.detectedMimeType,
      )
    )
      throw new Error('تصویر PNG/JPEG مجاز و فعال از همین شعبه انتخاب کنید.');
    if (
      data.currentVersion.scanStatus !== 'CLEAN' ||
      !data.capabilities.viewFile
    )
      throw new Error(
        'تصویر بارگذاری شد؛ پس از پایان بررسی امنیتی، «بررسی دوباره تصویر» را بزنید.',
      );
    patch('imageDocumentId', id);
    setImageName(data.title);
    setPendingImage('');
    setImageError('');
  }
  const numberValue = (raw: string) => (raw === '' ? undefined : Number(raw));
  return (
    <div className="space-y-5 sm:col-span-2">
      <section className="space-y-4 rounded-xl border p-4">
        <h4 className="font-bold">معرفی و شرایط تور</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          {prose.map(([key, label]) => (
            <FormField key={key} label={label}>
              <Textarea
                aria-label={label}
                rows={3}
                maxLength={key === 'summary' ? 500 : 5000}
                value={value[key] ?? ''}
                onChange={(e) => patch(key, e.target.value)}
              />
            </FormField>
          ))}
        </div>
      </section>
      <section className="space-y-4 rounded-xl border p-4">
        <h4 className="font-bold">قیمت و حمل‌ونقل</h4>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Menu
            label="فرودگاه مبدأ"
            value={value.originAirportCode ?? ''}
            choices={airports
              .filter((a) => a.attributes.iataCode)
              .map((a) => [
                String(a.attributes.iataCode),
                `${a.name} (${a.attributes.iataCode})`,
              ])}
            onChange={(v) => patch('originAirportCode', v)}
          />
          <FormField label="کد سه‌حرفی فرودگاه مبدأ (ورود دستی)">
            <Input
              aria-label="کد سه‌حرفی فرودگاه مبدأ"
              dir="ltr"
              maxLength={3}
              value={value.originAirportCode ?? ''}
              onChange={(e) =>
                patch(
                  'originAirportCode',
                  e.target.value.toUpperCase().replace(/[^A-Z]/g, ''),
                )
              }
            />
          </FormField>
          <FormField label="مدت سفر (روز)">
            <Input
              aria-label="مدت سفر (روز)"
              type="number"
              min={1}
              max={366}
              step={1}
              value={value.durationDays ?? ''}
              onChange={(e) =>
                patch('durationDays', numberValue(e.target.value))
              }
            />
          </FormField>
          <FormField label="امتیاز تور از ۵">
            <Input
              aria-label="امتیاز تور از ۵"
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={value.rating ?? ''}
              onChange={(e) => patch('rating', numberValue(e.target.value))}
            />
          </FormField>
          <Menu
            label="نوع حمل‌ونقل"
            value={value.transport ?? ''}
            choices={[
              ['FLIGHT', 'هواپیما'],
              ['TRAIN', 'قطار'],
            ]}
            onChange={(v) => {
              const next = { ...value };
              if (v) next.transport = v as NonNullable<Details['transport']>;
              else delete next.transport;
              if (v === 'TRAIN') {
                delete next.airlineName;
                delete next.flightPrice;
              }
              onChange(next);
            }}
          />
          {value.transport !== 'TRAIN' && (
            <Menu
              label="ایرلاین"
              value={value.airlineName ?? ''}
              choices={airlines.map((a) => [a.name, a.name])}
              onChange={(v) => patch('airlineName', v)}
            />
          )}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value.ticketIncluded ?? true}
              onChange={(e) => patch('ticketIncluded', e.target.checked)}
            />
            بلیط در پکیج محاسبه شده است
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          قیمت‌ها معرفی پکیج هستند؛ هزینه خرید و ظرفیت بلیط را تغییر نمی‌دهند.
          نوبت‌های فعلی با بلیط پرواز منتشرشده ثبت می‌شوند؛ نوع قطار در این بخش
          فقط مشخصات تعریف تور است.
        </p>
        {(
          [
            'basePrice',
            ...(value.transport === 'TRAIN' ? [] : ['flightPrice']),
          ] as ('basePrice' | 'flightPrice')[]
        ).map((key) => (
          <div
            key={key}
            className="grid gap-3 rounded-lg bg-primary/5 p-3 sm:grid-cols-2"
          >
            <FormField
              label={
                key === 'basePrice'
                  ? 'قیمت پایه پکیج (بدون انتخاب هتل جایگزین)'
                  : 'هزینه جداگانه پرواز (اختیاری)'
              }
            >
              <Input
                aria-label={
                  key === 'basePrice' ? 'قیمت پایه پکیج' : 'هزینه جداگانه پرواز'
                }
                dir="ltr"
                inputMode="decimal"
                value={value[key]?.amount ?? ''}
                onChange={(e) => {
                  const amount = e.target.value
                    .replace(/[,٬]/g, '')
                    .replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)));
                  patch(
                    key,
                    amount
                      ? { amount, currency: value[key]?.currency ?? 'IRR' }
                      : undefined,
                  );
                }}
              />
            </FormField>
            <Menu
              label={key === 'basePrice' ? 'ارز پکیج' : 'ارز هزینه پرواز'}
              value={value[key]?.currency ?? 'IRR'}
              choices={[
                ['IRT', 'تومان (ذخیره معادل ریالی)'],
                ...currencies
                  .filter((c) => c.code !== 'IRT')
                  .map((c) => [c.code, `${c.name} (${c.code})`] as const),
              ]}
              onChange={(currency) =>
                patch(key, { amount: value[key]?.amount ?? '', currency })
              }
            />
          </div>
        ))}
      </section>
      <section className="space-y-4 rounded-xl border p-4">
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-bold">برنامه سفر و رویدادهای تور</h4>
          <Button
            type="button"
            variant="outline"
            disabled={(value.itinerary?.length ?? 0) >= 100}
            onClick={() => patch('itinerary', [...(value.itinerary ?? []), {}])}
          >
            افزودن مرحله
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          مراحل به همین ترتیب نمایش داده می‌شوند. تاریخ هر نوبت جداست؛ اینجا فقط
          ساعت ۲۴ ساعته و مدت‌زمان را وارد کنید. تمام مشخصات مرحله اختیاری‌اند.
        </p>
        {(value.itinerary ?? []).map((step, index) => (
          <div
            key={index}
            className="space-y-3 rounded-xl border bg-primary/5 p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h5 className="me-auto font-semibold">مرحله {index + 1}</h5>
              {([-1, 1] as const).map((delta) => (
                <Button
                  key={delta}
                  type="button"
                  variant="outline"
                  disabled={
                    index + delta < 0 ||
                    index + delta >= value.itinerary!.length
                  }
                  onClick={() => {
                    const steps = [...value.itinerary!];
                    [steps[index], steps[index + delta]] = [
                      steps[index + delta]!,
                      steps[index]!,
                    ];
                    patch('itinerary', steps);
                  }}
                >
                  {delta === -1 ? 'بالاتر' : 'پایین‌تر'}
                </Button>
              ))}
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  patch(
                    'itinerary',
                    value.itinerary!.filter((_, i) => i !== index),
                  )
                }
              >
                حذف مرحله {index + 1}
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Menu
                label={`نوع مرحله ${index + 1}`}
                value={step.kind ?? ''}
                choices={kinds}
                onChange={(v) => stepPatch(index, 'kind', v)}
              />
              {(
                [
                  ['title', 'عنوان مرحله'],
                  ['location', 'شهر یا محل رویداد'],
                  ['startTime', 'ساعت شروع (14:30)'],
                  ['transport', 'وسیله جابه‌جایی'],
                  ['cabinClass', 'کلاس سفر'],
                ] as const
              ).map(([key, label]) => (
                <FormField key={key} label={label}>
                  <Input
                    aria-label={`${label} مرحله ${index + 1}`}
                    value={step[key] ?? ''}
                    maxLength={key === 'startTime' ? 5 : 160}
                    dir={key === 'startTime' ? 'ltr' : undefined}
                    onChange={(e) => stepPatch(index, key, e.target.value)}
                  />
                </FormField>
              ))}
              {(
                [
                  ['stayDays', 'مدت اقامت (روز)', 366],
                  ['durationMinutes', 'مدت‌زمان (دقیقه)', 527040],
                  ['baggageKg', 'بار مجاز (کیلوگرم)', 1000],
                ] as const
              ).map(([key, label, max]) => (
                <FormField key={key} label={label}>
                  <Input
                    aria-label={`${label} مرحله ${index + 1}`}
                    type="number"
                    min={0}
                    max={max}
                    step={key === 'baggageKg' ? 0.1 : 1}
                    value={step[key] ?? ''}
                    onChange={(e) =>
                      stepPatch(index, key, numberValue(e.target.value))
                    }
                  />
                </FormField>
              ))}
              <FormField label="توضیحات این مرحله">
                <Textarea
                  aria-label={`توضیحات مرحله ${index + 1}`}
                  maxLength={2000}
                  value={step.description ?? ''}
                  onChange={(e) =>
                    stepPatch(index, 'description', e.target.value)
                  }
                />
              </FormField>
            </div>
          </div>
        ))}
      </section>
      <section className="space-y-3 rounded-xl border p-4">
        <h4 className="font-bold">تصویر تور</h4>
        <p className="text-xs text-muted-foreground">
          تصویر در آرشیو امن اسناد همین شعبه ذخیره می‌شود؛ فقط PNG یا JPEG
          تأییدشده قابل اتصال است.
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={!branchId || imageBusy}
          onClick={() => {
            setImageBusy(true);
            void documentsApi
              .options()
              .then((r) => {
                setOptions({
                  ...r.data,
                  documentTypes: r.data.documentTypes.filter(
                    (type) => type.domain === 'BRAND',
                  ),
                  uploadPolicy: {
                    ...r.data.uploadPolicy,
                    allowedMimeTypes: ['image/png', 'image/jpeg'],
                  },
                });
                setUploadOpen(true);
              })
              .catch((e: Error) => setImageError(e.message))
              .finally(() => setImageBusy(false));
          }}
        >
          بارگذاری تصویر تور
        </Button>
        {value.imageDocumentId && (
          <div className="flex gap-3">
            <a
              className="text-primary underline"
              href={`/documents?document=${encodeURIComponent(value.imageDocumentId)}`}
              target="_blank"
              rel="noreferrer"
            >
              {imageName || 'مشاهده تصویر در آرشیو'}
            </a>
            <Button
              type="button"
              variant="ghost"
              onClick={() => patch('imageDocumentId', undefined)}
            >
              حذف تصویر از تعریف تور
            </Button>
          </div>
        )}
        {pendingImage && (
          <Button
            type="button"
            variant="outline"
            disabled={imageBusy}
            onClick={() => {
              setImageBusy(true);
              void checkImage(pendingImage)
                .catch((e: Error) => setImageError(e.message))
                .finally(() => setImageBusy(false));
            }}
          >
            بررسی دوباره تصویر
          </Button>
        )}
        {imageError && (
          <p role="alert" className="text-sm text-destructive">
            {imageError}
          </p>
        )}
        <DocumentUploadDialog
          key={uploadOpen ? 'open' : 'closed'}
          branches={branches.filter((b) => b.id === branchId)}
          options={options}
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          error={imageError}
          submitting={imageBusy}
          onSubmit={async (form) => {
            setImageBusy(true);
            setImageError('');
            try {
              const file = form.get('file');
              if (
                !(file instanceof File) ||
                !['image/png', 'image/jpeg'].includes(file.type)
              )
                throw new Error('فقط تصویر PNG یا JPEG انتخاب کنید.');
              const { data } = await documentsApi.upload(form);
              setPendingImage(data.id);
              setUploadOpen(false);
              await checkImage(data.id);
              return true;
            } catch (e) {
              setImageError(
                e instanceof Error ? e.message : 'بارگذاری تصویر ناموفق بود.',
              );
              return false;
            } finally {
              setImageBusy(false);
            }
          }}
        />
      </section>
    </div>
  );
}
