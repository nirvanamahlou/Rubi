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

type TicketDefinitionMode = 'one-way' | 'round-trip';

export function createReturnTicketDraft(source: ProductInput): ProductInput {
  const outbound = source.segments[0]!;
  return {
    ...source,
    title: '',
    fare: { ...source.fare },
    segments: [
      {
        ...outbound,
        flightNumber: '',
        originCountryId: outbound.destinationCountryId,
        originCityId: outbound.destinationCityId,
        originAirportId: outbound.destinationAirportId,
        destinationCountryId: outbound.originCountryId,
        destinationCityId: outbound.originCityId,
        destinationAirportId: outbound.originAirportId,
        departureAt: '',
        arrivalAt: '',
        departureZone: outbound.arrivalZone,
        arrivalZone: outbound.departureZone,
      },
    ],
  };
}

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
  allowRoundTrip = false,
}: {
  initial: ProductInput;
  references: readonly Reference[];
  onReference?: (reference: Reference) => void;
  onSave: (inputs: readonly ProductInput[], reason: string) => void;
  onCancel: () => void;
  readOnly?: boolean;
  allowRoundTrip?: boolean;
}) {
  const [input, setInput] = useState(initial);
  const [definitionMode, setDefinitionMode] =
    useState<TicketDefinitionMode>('one-way');
  const [returnInput, setReturnInput] = useState(() =>
    createReturnTicketDraft(initial),
  );
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
  const [returnDeparture, setReturnDeparture] = useState('');
  const [returnArrival, setReturnArrival] = useState('');
  const [returnDepartureOffset, setReturnDepartureOffset] = useState(
    offsetValue('', first.arrivalZone),
  );
  const [returnArrivalOffset, setReturnArrivalOffset] = useState(
    offsetValue('', first.departureZone),
  );
  const [validFrom, setValidFrom] = useState(
    initial.fare.validFrom.slice(0, 16),
  );
  const [validTo, setValidTo] = useState(initial.fare.validTo.slice(0, 16));
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const segment = input.segments[0]!;
  const returnSegment = returnInput.segments[0]!;
  const changeSegment = (patch: Partial<Segment>) =>
    setInput({ ...input, segments: [{ ...segment, ...patch }] });
  const changeReturnSegment = (patch: Partial<Segment>) =>
    setReturnInput({
      ...returnInput,
      segments: [{ ...returnSegment, ...patch }],
    });
  function chooseDefinitionMode(mode: TicketDefinitionMode) {
    setDefinitionMode(mode);
    if (mode === 'round-trip') {
      const draft = createReturnTicketDraft(input);
      const draftSegment = draft.segments[0]!;
      setReturnInput(draft);
      setReturnDeparture('');
      setReturnArrival('');
      setReturnDepartureOffset(offsetValue('', draftSegment.departureZone));
      setReturnArrivalOffset(offsetValue('', draftSegment.arrivalZone));
    }
  }
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
      if (definitionMode === 'round-trip' && allowRoundTrip) {
        const returnDefinition: ProductInput = {
          ...returnInput,
          supplyType: definition.supplyType,
          companyOwned: definition.companyOwned,
          entryMethod: definition.entryMethod,
          totalCapacity: definition.totalCapacity,
          rules: definition.rules,
          fare: { ...definition.fare },
          segments: [
            {
              ...returnSegment,
              departureAt: wallTimeToUtc(
                returnDeparture,
                returnSegment.departureZone,
                returnDepartureOffset,
              ),
              arrivalAt: wallTimeToUtc(
                returnArrival,
                returnSegment.arrivalZone,
                returnArrivalOffset,
              ),
            },
          ],
        };
        onSave([definition, returnDefinition], reason);
      } else {
        onSave([definition], reason);
      }
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
        {allowRoundTrip ? (
          <section className="space-y-3">
            <h3 className="font-bold text-primary">۱. نوع تعریف بلیت</h3>
            <FormField label="نوع بلیت" id="ticket-definition-mode" required>
              <select
                id="ticket-definition-mode"
                className="h-11 rounded-xl border bg-surface px-3"
                value={definitionMode}
                onChange={(event) =>
                  chooseDefinitionMode(
                    event.target.value as TicketDefinitionMode,
                  )
                }
              >
                <option value="one-way">یک‌طرفه</option>
                <option value="round-trip">رفت‌وبرگشت</option>
              </select>
            </FormField>
            <p className="text-xs leading-6 text-muted-foreground">
              در حالت رفت‌وبرگشت، دو بلیت مستقل ساخته می‌شود؛ هر بلیت بعداً هم
              جداگانه و هم در ترکیب رفت‌وبرگشت قابل فروش است.
            </p>
          </section>
        ) : null}
        <section className="space-y-4">
          <h3 className="font-bold text-primary">
            {allowRoundTrip ? '۲. مشخصات بلیت رفت' : '۱. مشخصات بلیت'}
          </h3>
          <FormField
            label={
              definitionMode === 'round-trip' ? 'نام بلیت رفت' : 'نام بلیت'
            }
            id="ticket-title"
            required
          >
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
            <ReferencePicker
              id="ticket-aircraft"
              label="نوع هواپیما"
              resource="aircraft-types"
              readOnly={readOnly}
              value={references.find(
                (r) => r.kind === 'aircraft' && r.id === segment.aircraftId,
              )}
              onSelect={(ref) => {
                if (ref) onReference?.(ref);
                changeSegment({ aircraftId: ref?.id ?? '' });
              }}
            />
            <ReferencePicker
              id="ticket-flight-class"
              label="کلاس پروازی"
              resource="cabin-classes"
              readOnly={readOnly}
              value={references.find(
                (r) => r.kind === 'flightClass' && r.id === input.flightClassId,
              )}
              onSelect={(ref) => {
                if (ref) onReference?.(ref);
                setInput({ ...input, flightClassId: ref?.id ?? '' });
              }}
            />
            <ReferencePicker
              id="ticket-baggage"
              label="بار مجاز"
              resource="baggage-rules"
              readOnly={readOnly}
              value={references.find(
                (r) => r.kind === 'baggage' && r.id === input.baggageId,
              )}
              onSelect={(ref) => {
                if (ref) onReference?.(ref);
                setInput({ ...input, baggageId: ref?.id ?? '' });
              }}
            />
          </div>
        </section>
        <section className="space-y-4">
          <h3 className="font-bold text-primary">مسیر بلیت مستقل</h3>
          <p className="text-xs text-muted-foreground">
            کشور و شهر از اطلاعات پایه انتخاب می‌شوند و جایگزین فرودگاه نیستند.
            فرودگاه نیز از اطلاعات پایه انتخاب می‌شود. این مسیر یک بلیت مستقل
            است و در حالت رفت‌وبرگشت، مسیر برگشت نیز مستقل ثبت می‌شود.
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
                <ReferencePicker
                  key={`${segment[`${end}CityId`]}-airport`}
                  id={`ticket-${end}-airport`}
                  label={`فرودگاه ${end === 'origin' ? 'مبدأ' : 'مقصد'}`}
                  resource="airports"
                  readOnly={readOnly}
                  countryId={segment[`${end}CountryId`]}
                  cityId={segment[`${end}CityId`]}
                  value={references.find(
                    (r) =>
                      r.kind === 'airport' &&
                      r.id === segment[`${end}AirportId`],
                  )}
                  onSelect={(ref) => {
                    if (ref) onReference?.(ref);
                    changeSegment({ [`${end}AirportId`]: ref?.id ?? '' });
                  }}
                />
              </div>
            ))}
          </div>
        </section>
        <section className="space-y-4">
          <h3 className="font-bold text-primary">زمان بلیت رفت</h3>
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
        </section>
        {definitionMode === 'round-trip' && allowRoundTrip ? (
          <section className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <h3 className="font-bold text-primary">۳. مشخصات بلیت برگشت</h3>
            <Alert
              title="بلیت برگشت مستقل ثبت می‌شود"
              description="تأمین، ظرفیت، نرخ خرید و قوانین از بلیت رفت کپی می‌شوند؛ بعد از ثبت می‌توانید هر بلیت را جداگانه ویرایش یا بفروشید."
            />
            <FormField label="نام بلیت برگشت" id="ticket-return-title" required>
              <Input
                id="ticket-return-title"
                value={returnInput.title}
                maxLength={160}
                required
                onChange={(event) =>
                  setReturnInput({ ...returnInput, title: event.target.value })
                }
              />
            </FormField>
            <div className={styles.fields}>
              <ReferencePicker
                id="ticket-return-airline"
                label="ایرلاین برگشت"
                resource="airlines"
                readOnly={readOnly}
                value={references.find(
                  (r) =>
                    r.kind === 'airline' && r.id === returnSegment.airlineId,
                )}
                onSelect={(ref) => {
                  if (ref) onReference?.(ref);
                  changeReturnSegment({ airlineId: ref?.id ?? '' });
                }}
              />
              <FormField
                label="شماره پرواز برگشت"
                id="ticket-return-flight"
                required
              >
                <Input
                  id="ticket-return-flight"
                  dir="ltr"
                  value={returnSegment.flightNumber}
                  maxLength={12}
                  required
                  onChange={(event) =>
                    changeReturnSegment({ flightNumber: event.target.value })
                  }
                />
              </FormField>
              <ReferencePicker
                id="ticket-return-aircraft"
                label="نوع هواپیمای برگشت"
                resource="aircraft-types"
                readOnly={readOnly}
                value={references.find(
                  (r) =>
                    r.kind === 'aircraft' && r.id === returnSegment.aircraftId,
                )}
                onSelect={(ref) => {
                  if (ref) onReference?.(ref);
                  changeReturnSegment({ aircraftId: ref?.id ?? '' });
                }}
              />
              <ReferencePicker
                id="ticket-return-flight-class"
                label="کلاس پروازی برگشت"
                resource="cabin-classes"
                readOnly={readOnly}
                value={references.find(
                  (r) =>
                    r.kind === 'flightClass' &&
                    r.id === returnInput.flightClassId,
                )}
                onSelect={(ref) => {
                  if (ref) onReference?.(ref);
                  setReturnInput({
                    ...returnInput,
                    flightClassId: ref?.id ?? '',
                  });
                }}
              />
              <ReferencePicker
                id="ticket-return-baggage"
                label="بار مجاز برگشت"
                resource="baggage-rules"
                readOnly={readOnly}
                value={references.find(
                  (r) => r.kind === 'baggage' && r.id === returnInput.baggageId,
                )}
                onSelect={(ref) => {
                  if (ref) onReference?.(ref);
                  setReturnInput({ ...returnInput, baggageId: ref?.id ?? '' });
                }}
              />
            </div>
            <h4 className="font-semibold">مسیر برگشت</h4>
            <p className="text-xs text-muted-foreground">
              مبدأ و مقصد از مسیر رفت معکوس شده‌اند و در صورت نیاز قابل تغییرند.
            </p>
            <div className={styles.fields}>
              {(['origin', 'destination'] as const).map((end) => (
                <div className="min-w-0 space-y-4" key={`return-${end}`}>
                  <ReferencePicker
                    id={`ticket-return-${end}-country`}
                    label={`کشور ${end === 'origin' ? 'مبدأ' : 'مقصد'} برگشت`}
                    resource="countries"
                    readOnly={readOnly}
                    value={references.find(
                      (r) =>
                        r.kind === 'country' &&
                        r.id === returnSegment[`${end}CountryId`],
                    )}
                    onSelect={(ref) => {
                      if (ref) onReference?.(ref);
                      changeReturnSegment({
                        [`${end}CountryId`]: ref?.id ?? '',
                        [`${end}CityId`]: '',
                        [`${end}AirportId`]: '',
                      });
                    }}
                  />
                  <ReferencePicker
                    key={returnSegment[`${end}CountryId`]}
                    id={`ticket-return-${end}-city`}
                    label={`شهر ${end === 'origin' ? 'مبدأ' : 'مقصد'} برگشت`}
                    resource="cities"
                    readOnly={readOnly}
                    countryId={returnSegment[`${end}CountryId`]}
                    value={references.find(
                      (r) =>
                        r.kind === 'city' &&
                        r.id === returnSegment[`${end}CityId`],
                    )}
                    onSelect={(ref) => {
                      if (ref) onReference?.(ref);
                      changeReturnSegment({
                        [`${end}CityId`]: ref?.id ?? '',
                        [`${end}AirportId`]: '',
                      });
                    }}
                  />
                  <ReferencePicker
                    key={`${returnSegment[`${end}CityId`]}-return-airport`}
                    id={`ticket-return-${end}-airport`}
                    label={`فرودگاه ${end === 'origin' ? 'مبدأ' : 'مقصد'} برگشت`}
                    resource="airports"
                    readOnly={readOnly}
                    countryId={returnSegment[`${end}CountryId`]}
                    cityId={returnSegment[`${end}CityId`]}
                    value={references.find(
                      (r) =>
                        r.kind === 'airport' &&
                        r.id === returnSegment[`${end}AirportId`],
                    )}
                    onSelect={(ref) => {
                      if (ref) onReference?.(ref);
                      changeReturnSegment({
                        [`${end}AirportId`]: ref?.id ?? '',
                      });
                    }}
                  />
                </div>
              ))}
            </div>
            <h4 className="font-semibold">زمان برگشت</h4>
            <div className={styles.fields}>
              <FormField
                label="تاریخ و ساعت حرکت برگشت"
                id="ticket-return-departure"
              >
                <TicketDatePicker
                  id="ticket-return-departure"
                  value={returnDeparture}
                  onChange={setReturnDeparture}
                  includeTime
                  disabled={readOnly}
                />
              </FormField>
              <FormField
                label="تاریخ و ساعت رسیدن برگشت"
                id="ticket-return-arrival"
              >
                <TicketDatePicker
                  id="ticket-return-arrival"
                  value={returnArrival}
                  onChange={setReturnArrival}
                  includeTime
                  disabled={readOnly}
                />
              </FormField>
              <FormField
                label="منطقه زمانی مبدأ برگشت (IANA)"
                id="ticket-return-departure-zone"
              >
                <Input
                  id="ticket-return-departure-zone"
                  dir="ltr"
                  value={returnSegment.departureZone}
                  onChange={(event) =>
                    changeReturnSegment({ departureZone: event.target.value })
                  }
                />
              </FormField>
              <FormField
                label="منطقه زمانی مقصد برگشت (IANA)"
                id="ticket-return-arrival-zone"
              >
                <Input
                  id="ticket-return-arrival-zone"
                  dir="ltr"
                  value={returnSegment.arrivalZone}
                  onChange={(event) =>
                    changeReturnSegment({ arrivalZone: event.target.value })
                  }
                />
              </FormField>
              <FormField
                label="اختلاف UTC مبدأ برگشت"
                id="ticket-return-departure-offset"
              >
                <Input
                  id="ticket-return-departure-offset"
                  dir="ltr"
                  placeholder="+03:30"
                  value={returnDepartureOffset}
                  onChange={(event) =>
                    setReturnDepartureOffset(event.target.value)
                  }
                />
              </FormField>
              <FormField
                label="اختلاف UTC مقصد برگشت"
                id="ticket-return-arrival-offset"
              >
                <Input
                  id="ticket-return-arrival-offset"
                  dir="ltr"
                  placeholder="+03:30"
                  value={returnArrivalOffset}
                  onChange={(event) =>
                    setReturnArrivalOffset(event.target.value)
                  }
                />
              </FormField>
            </div>
          </section>
        ) : null}
        <section className="space-y-4">
          <h3 className="font-bold text-primary">
            {definitionMode === 'round-trip' && allowRoundTrip
              ? '۴. تأمین و ظرفیت مشترک اولیه'
              : '۳. تأمین و ظرفیت'}
          </h3>
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
            ورود دستی به معنی مالکیت شرکت نیست. انتخاب سربرگ، داده بلیت و محدوده
            شعبه را تغییر نمی‌دهد. Hold، قطعی و باقی‌مانده واقعی منتظر
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
          <h3 className="font-bold text-primary">۵. شرایط بلیت</h3>
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
