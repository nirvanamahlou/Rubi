'use client';

import { useState, type FormEvent } from 'react';
import { Alert, Button, FormField, Input, Textarea } from '@/components/ui';
import {
  wallTimeToUtc,
  type ProductInput,
  type Reference,
  type Segment,
} from '../model/catalog';
import { supplyLabels } from '../model/preview';
import styles from './ticket-form.module.css';
import { TicketDatePicker } from './ticket-date-picker';
import { ReferencePicker } from './reference-picker';

function wallValue(utcValue: string, zone: string) {
  if (!utcValue) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(utcValue));
  const p = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${p('year')}-${p('month')}-${p('day')}T${p('hour')}:${p('minute')}`;
}
function offsetValue(utcValue: string, zone: string) {
  if (!utcValue) return zone === 'Asia/Tehran' ? '+03:30' : '+00:00';
  const delta = Math.round(
    (Date.parse(wallValue(utcValue, zone) + ':00Z') - Date.parse(utcValue)) /
      60000,
  );
  return `${delta >= 0 ? '+' : '-'}${Math.floor(Math.abs(delta) / 60)
    .toString()
    .padStart(2, '0')}:${(Math.abs(delta) % 60).toString().padStart(2, '0')}`;
}
export function TicketForm({
  initial,
  references,
  onSave,
  onReference,
  onCancel,
  readOnly = false,
}: {
  initial: ProductInput;
  references: readonly Reference[];
  onReference?: (reference: Reference) => void;
  onSave: (input: ProductInput, reason: string) => void;
  onCancel: () => void;
  readOnly?: boolean;
}) {
  const [input, setInput] = useState(initial);
  const first = initial.segments[0]!;
  const [departure, setDeparture] = useState(
    wallValue(first.departureAt, first.departureZone),
  );
  const [arrival, setArrival] = useState(
    wallValue(first.arrivalAt, first.arrivalZone),
  );
  const [departureOffset, setDepartureOffset] = useState(
    offsetValue(first.departureAt, first.departureZone),
  );
  const [arrivalOffset, setArrivalOffset] = useState(
    offsetValue(first.arrivalAt, first.arrivalZone),
  );
  const [validFrom, setValidFrom] = useState(
    initial.fare.validFrom.slice(0, 16),
  );
  const [validTo, setValidTo] = useState(initial.fare.validTo.slice(0, 16));
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const segment = input.segments[0]!;
  const changeSegment = (patch: Partial<Segment>) =>
    setInput({ ...input, segments: [{ ...segment, ...patch }] });
  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const definition = {
        ...input,
        segments: [
          {
            ...segment,
            departureAt: wallTimeToUtc(
              departure,
              segment.departureZone,
              departureOffset,
            ),
            arrivalAt: wallTimeToUtc(
              arrival,
              segment.arrivalZone,
              arrivalOffset,
            ),
          },
        ],
        fare: {
          ...input.fare,
          validFrom: wallTimeToUtc(validFrom, 'UTC', '+00:00'),
          validTo: wallTimeToUtc(validTo, 'UTC', '+00:00'),
        },
      };
      onSave(definition, reason);
      setError('');
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : 'اطلاعات فرم معتبر نیست.',
      );
    }
  }
  return (
    <form onSubmit={submit} className={`${styles.form} space-y-6`}>
      <Alert
        title="پیش‌نمایش؛ فقط حافظه همین صفحه"
        description="فرم به ذخیره واقعی متصل نیست. اطلاعات واقعی مسافر یا مشتری وارد نکنید. مراجع انتخاب‌نشده در پیش‌نویس خالی می‌مانند و فعال‌سازی را مسدود می‌کنند."
        tone="warning"
      />
      {error ? <Alert tone="error" title={error} /> : null}
      <fieldset disabled={readOnly} className="space-y-6 disabled:opacity-80">
        <section className="space-y-4">
          <h3 className="font-bold text-primary">۱. مشخصات برنامه</h3>
          <FormField label="عنوان برنامه" id="ticket-title" required>
            <Input
              id="ticket-title"
              value={input.title}
              maxLength={160}
              required
              onChange={(event) =>
                setInput({ ...input, title: event.target.value })
              }
            />
          </FormField>
          <div className={styles.fields}>
            <ReferencePicker
              id="ticket-airline"
              label="ایرلاین"
              resource="airlines"
              readOnly={readOnly}
              value={references.find(
                (r) => r.kind === 'airline' && r.id === segment.airlineId,
              )}
              onSelect={(ref) => {
                if (ref) onReference?.(ref);
                changeSegment({ airlineId: ref?.id ?? '' });
              }}
            />
            <FormField label="شماره پرواز" id="ticket-flight" required>
              <Input
                id="ticket-flight"
                dir="ltr"
                value={segment.flightNumber}
                maxLength={12}
                required
                onChange={(event) =>
                  changeSegment({ flightNumber: event.target.value })
                }
              />
            </FormField>
            {['هواپیما', 'کلاس پروازی', 'بار مجاز'].map((label) => (
              <FormField label={label} key={label}>
                <Input
                  disabled
                  aria-label={label}
                  value="منتظر API اطلاعات پایه"
                />
              </FormField>
            ))}
          </div>
        </section>
        <section className="space-y-4">
          <h3 className="font-bold text-primary">مسیر بلیت مستقل</h3>
          <p className="text-xs text-muted-foreground">
            کشور و شهر از اطلاعات پایه انتخاب می‌شوند و جایگزین فرودگاه نیستند.
            هر پرواز مستقل است؛ رفت‌وبرگشت با انتخاب دو بلیت در بخش ترکیب سفر
            ساخته می‌شود.
          </p>
          <div className={styles.fields}>
            {(['origin', 'destination'] as const).map((end) => (
              <div className="min-w-0 space-y-4" key={end}>
                <ReferencePicker
                  id={`ticket-${end}-country`}
                  label={`کشور ${end === 'origin' ? 'مبدأ' : 'مقصد'}`}
                  resource="countries"
                  readOnly={readOnly}
                  value={references.find(
                    (r) =>
                      r.kind === 'country' &&
                      r.id === segment[`${end}CountryId`],
                  )}
                  onSelect={(ref) => {
                    if (ref) onReference?.(ref);
                    changeSegment({
                      [`${end}CountryId`]: ref?.id ?? '',
                      [`${end}CityId`]: '',
                      [`${end}AirportId`]: '',
                    });
                  }}
                />
                <ReferencePicker
                  key={segment[`${end}CountryId`]}
                  id={`ticket-${end}-city`}
                  label={`شهر ${end === 'origin' ? 'مبدأ' : 'مقصد'}`}
                  resource="cities"
                  readOnly={readOnly}
                  countryId={segment[`${end}CountryId`]}
                  value={references.find(
                    (r) =>
                      r.kind === 'city' && r.id === segment[`${end}CityId`],
                  )}
                  onSelect={(ref) => {
                    if (ref) onReference?.(ref);
                    changeSegment({
                      [`${end}CityId`]: ref?.id ?? '',
                      [`${end}AirportId`]: '',
                    });
                  }}
                />
                <FormField
                  label={`فرودگاه ${end === 'origin' ? 'مبدأ' : 'مقصد'}`}
                  id={`ticket-${end}-airport`}
                >
                  <Input
                    id={`ticket-${end}-airport`}
                    disabled
                    value="جست‌وجوی فرودگاه — منتظر API اطلاعات پایه"
                  />
                </FormField>
              </div>
            ))}
          </div>
        </section>
        <section className="space-y-4">
          <h3 className="font-bold text-primary">۲. زمان و مسیر یک‌طرفه</h3>
          <p className="text-xs text-muted-foreground">
            تقویم شمسی/میلادی برای ورود است؛ اعتبارسنجی با UTC انجام می‌شود.
            برای عبور از نیمه‌شب، تاریخ رسیدن را روز بعد انتخاب کنید.
          </p>
          <div className={styles.fields}>
            <FormField label="تاریخ و ساعت حرکت" id="ticket-departure">
              <TicketDatePicker
                id="ticket-departure"
                value={departure}
                onChange={setDeparture}
                includeTime
                disabled={readOnly}
              />
            </FormField>
            <FormField label="تاریخ و ساعت رسیدن" id="ticket-arrival">
              <TicketDatePicker
                id="ticket-arrival"
                value={arrival}
                onChange={setArrival}
                includeTime
                disabled={readOnly}
              />
            </FormField>
            <FormField
              label="منطقه زمانی مبدأ (IANA)"
              id="ticket-departure-zone"
            >
              <Input
                id="ticket-departure-zone"
                dir="ltr"
                value={segment.departureZone}
                onChange={(event) =>
                  changeSegment({ departureZone: event.target.value })
                }
              />
            </FormField>
            <FormField label="منطقه زمانی مقصد (IANA)" id="ticket-arrival-zone">
              <Input
                id="ticket-arrival-zone"
                dir="ltr"
                value={segment.arrivalZone}
                onChange={(event) =>
                  changeSegment({ arrivalZone: event.target.value })
                }
              />
            </FormField>
            <FormField label="اختلاف UTC مبدأ" id="ticket-departure-offset">
              <Input
                id="ticket-departure-offset"
                dir="ltr"
                placeholder="+03:30"
                value={departureOffset}
                onChange={(event) => setDepartureOffset(event.target.value)}
              />
            </FormField>
            <FormField label="اختلاف UTC مقصد" id="ticket-arrival-offset">
              <Input
                id="ticket-arrival-offset"
                dir="ltr"
                placeholder="+03:30"
                value={arrivalOffset}
                onChange={(event) => setArrivalOffset(event.target.value)}
              />
            </FormField>
          </div>
          <p className="text-xs text-muted-foreground">
            مدل دامنه چندقطعه‌ای است؛ ویرایش رفت‌وبرگشت و چند Segment در توسعه
            بعدی رابط قرار دارد.
          </p>
        </section>
        <section className="space-y-4">
          <h3 className="font-bold text-primary">۳. تأمین و ظرفیت</h3>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={input.companyOwned}
              onChange={(event) =>
                setInput({
                  ...input,
                  companyOwned: event.target.checked,
                  supplyType: event.target.checked ? 'company' : 'supplier',
                })
              }
            />
            ظرفیت متعلق به شرکت است
          </label>
          <div className={styles.fields}>
            <FormField label="نوع تأمین" id="ticket-supply">
              <select
                id="ticket-supply"
                className="h-11 rounded-xl border bg-surface px-3"
                value={input.supplyType}
                onChange={(event) =>
                  setInput({
                    ...input,
                    supplyType: event.target
                      .value as ProductInput['supplyType'],
                    companyOwned: event.target.value === 'company',
                  })
                }
              >
                {Object.entries(supplyLabels).map(([key, label]) => (
                  <option value={key} key={key}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="روش ورود" id="ticket-entry">
              <select
                id="ticket-entry"
                className="h-11 rounded-xl border bg-surface px-3"
                value={input.entryMethod}
                onChange={(event) =>
                  setInput({
                    ...input,
                    entryMethod: event.target
                      .value as ProductInput['entryMethod'],
                  })
                }
              >
                <option value="manual">دستی</option>
                <option value="api" disabled>
                  API — اتصال Provider آماده نیست
                </option>
              </select>
            </FormField>
            <FormField label="ظرفیت کل تعریف‌شده" id="ticket-capacity">
              <Input
                id="ticket-capacity"
                type="number"
                min={0}
                step={1}
                value={
                  Number.isNaN(input.totalCapacity) ? '' : input.totalCapacity
                }
                onChange={(event) =>
                  setInput({
                    ...input,
                    totalCapacity:
                      event.target.value === ''
                        ? NaN
                        : Number(event.target.value),
                  })
                }
              />
            </FormField>
          </div>
          <p className="text-xs leading-6 text-muted-foreground">
            ورود دستی به معنی مالکیت شرکت نیست. انتخاب سربرگ، داده برنامه و
            محدوده شعبه را تغییر نمی‌دهد. Hold، قطعی و باقی‌مانده واقعی منتظر
            رزرواسیون‌اند و ورودی دستی ندارند.
          </p>
        </section>
        <section className="space-y-4">
          <h3 className="font-bold text-primary">
            ۴. قیمت خرید و نسخه نرخ تأمین
          </h3>
          <Alert
            title="قیمت فروش داینامیک است"
            description="قیمت فروش هنگام فروش و در قرارداد یا پیشنهاد فروش تعیین می‌شود؛ این فرم قیمت فروش ثابت ندارد."
          />
          <div className={styles.fields}>
            <ReferencePicker
              id="ticket-currency"
              label="ارز خرید"
              resource="currencies"
              readOnly={readOnly}
              value={references.find(
                (r) => r.kind === 'currency' && r.id === input.fare.currencyId,
              )}
              onSelect={(ref) => {
                if (ref) onReference?.(ref);
                setInput({
                  ...input,
                  fare: {
                    ...input.fare,
                    currencyId: ref?.id ?? '',
                    currencyCode: ref?.code ?? '',
                  },
                });
              }}
            />
            {(
              [
                ['purchase', 'قیمت خرید'],
                ['fee', 'کارمزد (مبلغ مستقل)'],
                ['commission', 'کمیسیون (مبلغ مستقل)'],
              ] as const
            ).map(([key, label]) => (
              <FormField label={label} key={key} id={'ticket-' + key}>
                <Input
                  id={'ticket-' + key}
                  dir="ltr"
                  inputMode="decimal"
                  value={input.fare[key]}
                  onChange={(event) =>
                    setInput({
                      ...input,
                      fare: { ...input.fare, [key]: event.target.value },
                    })
                  }
                />
              </FormField>
            ))}
            <FormField label="شروع اعتبار نرخ (UTC)" id="ticket-valid-from">
              <TicketDatePicker
                id="ticket-valid-from"
                value={validFrom}
                onChange={setValidFrom}
                includeTime
                disabled={readOnly}
              />
            </FormField>
            <FormField label="پایان اعتبار نرخ (UTC)" id="ticket-valid-to">
              <TicketDatePicker
                id="ticket-valid-to"
                value={validTo}
                onChange={setValidTo}
                includeTime
                disabled={readOnly}
              />
            </FormField>
          </div>
          <p className="text-xs text-muted-foreground">
            مبالغ رشته Decimal هستند. سیاست اعمال کارمزد/تخفیف هنوز باز است؛ جمع
            نهایی، تبدیل ارز یا سود حسابداری محاسبه نمی‌شود. تغییر قیمت نسخه
            تازه می‌سازد.
          </p>
        </section>
        <section className="space-y-4">
          <h3 className="font-bold text-primary">۵. شرایط همین محصول</h3>
          <FormField
            label="قوانین تغییر، کنسلی و محدودیت فروش"
            id="ticket-rules"
          >
            <Textarea
              id="ticket-rules"
              value={input.rules}
              maxLength={4000}
              onChange={(event) =>
                setInput({ ...input, rules: event.target.value })
              }
            />
          </FormField>
          <FormField label="دلیل تغییر / یادداشت پیش‌نمایش" id="ticket-reason">
            <Input
              id="ticket-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
        </section>
      </fieldset>
      <div
        className={`${styles.actions} sticky bottom-0 flex flex-wrap gap-3 border-t bg-surface py-4`}
      >
        {!readOnly ? (
          <Button type="submit">اعمال فقط در پیش‌نمایش</Button>
        ) : null}
        <Button type="button" variant="outline" onClick={onCancel}>
          بستن فرم
        </Button>
        <Button type="button" disabled variant="ghost">
          ذخیره واقعی — منتظر API و مجوز
        </Button>
      </div>
    </form>
  );
}
