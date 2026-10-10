'use client';

import { useRef, useState } from 'react';
import { browserRandomUuid } from '@/lib/browser-random-uuid';
import { Alert, Button, FormField, Input } from '@/components/ui';
import type { ProductInput, Reference, Segment } from '../model/catalog';
import { emptyInput } from '../model/preview';
import { supplyOptions } from '../model/preview';
import { TicketBaggageFields } from './ticket-baggage-fields';
import {
  buildWeekdayTickets,
  chronologicalScheduleDates,
  defaultReturnMaxDays,
  scheduleDates,
  scheduleWeekdayName,
  scheduleWeekdays,
  type ScheduleLeg,
  type WeekdayStay,
} from '../model/weekday-schedule';
import { ReferencePicker } from './reference-picker';
import { TicketDatePicker } from './ticket-date-picker';
import { ManifestTemplatePicker } from './manifest-template-picker';
import {
  buildAutomaticTicketTitle,
  createReturnTicketDraft,
  saveTicketFormOnCtrlS,
  scheduleToUtc,
  TicketForm,
  withDisplaySnapshot,
} from './ticket-form';
import type { PublishedResource } from '../api/references';
import styles from './flight-schedule-form.module.css';
import { FlightCabinCapacities } from './flight-cabin-capacities';
import {
  expandFlightCabins,
  type FlightCabinCapacity,
} from '../model/flight-cabins';

export function FlightScheduleForm({
  references,
  onReference,
  onSave,
  onCancel,
}: {
  references: readonly Reference[];
  onReference: (reference: Reference) => void;
  onSave: (
    inputs: readonly ProductInput[],
    reason: string,
    allowPastDate?: boolean,
  ) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [additionalCabins, setAdditionalCabins] = useState<
    FlightCabinCapacity[]
  >([]);
  const [mode, setMode] = useState<'one-way' | 'round-trip' | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [maxEdited, setMaxEdited] = useState(false);
  const [input, setInput] = useState<ProductInput>(() => ({
    ...emptyInput(),
    supplyType: 'company',
    companyOwned: true,
  }));
  const [start, setStart] = useState(''),
    [end, setEnd] = useState('');
  const [allowPastDate, setAllowPastDate] = useState(false);
  const [weekdays, setWeekdays] = useState<WeekdayStay[]>([]);
  const [returnDetails, setReturnDetails] = useState({
    flightNumber: '',
    aircraftId: '',
    baggageId: '',
    economyBaggageKg: null as string | null,
    businessBaggageKg: null as string | null,
  });
  const [outboundTime, setOutboundTime] = useState<ScheduleLeg>({
    departure: '',
    arrival: '',
    arrivalDayOffset: 0,
  });
  const [returnTime, setReturnTime] = useState<ScheduleLeg>({
    departure: '',
    arrival: '',
    arrivalDayOffset: 0,
  });
  const [problem, setProblem] = useState(''),
    [saving, setSaving] = useState(false);
  const submitting = useRef(false),
    batchId = useRef('');
  const segment = input.segments[0]!;
  const ref = (kind: Reference['kind'], id: string) =>
    references.find((r) => r.kind === kind && r.id === id);
  const patchSegment = (patch: Partial<Segment>) =>
    setInput((current) => ({
      ...current,
      segments: [{ ...current.segments[0]!, ...patch }],
    }));
  const picker = (
    id: string,
    label: string,
    resource: PublishedResource,
    kind: Reference['kind'],
    value: string,
    change: (r: Reference | undefined) => void,
    filters: { countryId?: string; cityId?: string } = {},
  ) => (
    <ReferencePicker
      id={id}
      label={label}
      resource={resource}
      value={ref(kind, value)}
      {...filters}
      readOnly={saving}
      onSelect={(r) => {
        if (r) onReference(r);
        change(r);
      }}
    />
  );
  let preview: ReturnType<typeof scheduleDates> = [],
    previewError = '';
  if (start && end && weekdays.length && mode) {
    try {
      preview = scheduleDates(start, end, weekdays, mode === 'round-trip');
    } catch (error) {
      previewError =
        error instanceof Error ? error.message : 'بازه معتبر نیست.';
    }
  }
  const returnCount = new Set(
    preview.flatMap((p) => (p.returning ? [p.returning] : [])),
  ).size;
  const orderedPreview = chronologicalScheduleDates(preview);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!mode || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setProblem('');
    try {
      const dates = scheduleDates(start, end, weekdays, mode === 'round-trip');
      if (!batchId.current) batchId.current = browserRandomUuid();
      const outbound = {
        ...input,
        returnMinDays:
          mode === 'round-trip' ? (input.returnMinDays ?? null) : null,
        returnMaxDays:
          mode === 'round-trip' ? (input.returnMaxDays ?? null) : null,
        journeyRole:
          mode === 'round-trip' ? ('outbound' as const) : ('one-way' as const),
      };
      const draft = createReturnTicketDraft(outbound);
      const returning: ProductInput = {
        ...draft,
        returnMinDays: null,
        returnMaxDays: null,
        baggageId: returnDetails.baggageId,
        economyBaggageKg: returnDetails.economyBaggageKg,
        businessBaggageKg: returnDetails.businessBaggageKg,
        segments: [
          {
            ...draft.segments[0]!,
            flightNumber: returnDetails.flightNumber,
            aircraftId: returnDetails.aircraftId,
          },
        ],
      };
      const definitions = buildWeekdayTickets(
        dates,
        outbound,
        mode === 'round-trip' ? returning : undefined,
        outboundTime,
        returnTime,
        batchId.current,
        scheduleToUtc,
        !maxEdited,
      )
        .flatMap((definition) =>
          expandFlightCabins(definition, additionalCabins, references),
        )
        .map((definition) =>
          withDisplaySnapshot(
            {
              ...definition,
              title: buildAutomaticTicketTitle(definition, references),
            },
            references,
          ),
        );
      await onSave(definitions, 'تعریف برنامه هفتگی پرواز', allowPastDate);
    } catch (error) {
      setProblem(
        error instanceof Error ? error.message : 'ثبت برنامه ناموفق بود.',
      );
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  if (advanced)
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => setAdvanced(false)}>
          بازگشت به برنامه هفتگی پرواز
        </Button>
        <TicketForm
          initial={emptyInput()}
          references={references}
          onReference={onReference}
          onSave={onSave}
          onCancel={onCancel}
          allowRoundTrip
          allowMultipleClasses
        />
      </div>
    );
  const route = (side: 'origin' | 'destination') => {
    const label = side === 'origin' ? 'مبدأ' : 'مقصد';
    return (
      <section className={styles.route}>
        <h3>{label}</h3>
        {picker(
          `schedule-${side}-country`,
          'کشور',
          'countries',
          'country',
          segment[`${side}CountryId`],
          (r) =>
            patchSegment({
              [`${side}CountryId`]: r?.id ?? '',
              [`${side}CityId`]: '',
              [`${side}AirportId`]: '',
              [side === 'origin' ? 'departureZone' : 'arrivalZone']: 'UTC',
            }),
        )}
        {picker(
          `schedule-${side}-city`,
          'شهر',
          'cities',
          'city',
          segment[`${side}CityId`],
          (r) =>
            patchSegment({
              [`${side}CityId`]: r?.id ?? '',
              [`${side}AirportId`]: '',
              [side === 'origin' ? 'departureZone' : 'arrivalZone']: 'UTC',
            }),
          { countryId: segment[`${side}CountryId`] },
        )}
        {picker(
          `schedule-${side}-airport`,
          'فرودگاه',
          'airports',
          'airport',
          segment[`${side}AirportId`],
          (r) =>
            patchSegment({
              [`${side}AirportId`]: r?.id ?? '',
              [side === 'origin' ? 'departureZone' : 'arrivalZone']:
                r?.timezone ?? 'UTC',
            }),
          { cityId: segment[`${side}CityId`] },
        )}
      </section>
    );
  };
  const code = (airportId: string) =>
    ref('airport', airportId)?.code || ref('airport', airportId)?.name || '—';

  return (
    <form
      className={styles.form}
      dir="rtl"
      onKeyDown={saveTicketFormOnCtrlS}
      onSubmit={(event) => void submit(event)}
    >
      <div className={styles.mode} role="group" aria-label="نوع بلیت">
        <strong>نوع بلیت</strong>
        {(['one-way', 'round-trip'] as const).map((choice) => (
          <label key={choice}>
            <input
              type="radio"
              name="flight-schedule-mode"
              checked={mode === choice}
              disabled={saving}
              onChange={() => setMode(choice)}
            />
            {choice === 'one-way' ? 'یک‌طرفه' : 'رفت‌وبرگشت'}
          </label>
        ))}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={saving}
          onClick={() => setAdvanced(true)}
        >
          قطار، اتوبوس یا مسیر ترکیبی
        </Button>
      </div>
      {problem ? <Alert tone="error" title={problem} /> : null}
      {mode ? (
        <fieldset disabled={saving} className={styles.body}>
          <div className={styles.top}>
            {route('origin')}
            {route('destination')}
            <section className={styles.route}>
              <h3>شروع و پایان پروازهای رفت</h3>
              <FormField id="schedule-start" label="از تاریخ" required>
                <TicketDatePicker
                  id="schedule-start"
                  required
                  value={start}
                  onChange={setStart}
                />
              </FormField>
              <FormField id="schedule-end" label="تا تاریخ" required>
                <TicketDatePicker
                  id="schedule-end"
                  required
                  value={end}
                  onChange={setEnd}
                />
              </FormField>
              <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={allowPastDate}
                  onChange={(event) => setAllowPastDate(event.target.checked)}
                />
                تاریخ گذشته
              </label>
              {picker(
                'schedule-airline',
                'ایرلاین',
                'airlines',
                'airline',
                segment.airlineId,
                (r) => patchSegment({ airlineId: r?.id ?? '' }),
              )}
            </section>
          </div>
          <div className={styles.weekdays}>
            <strong>روزهای پرواز رفت</strong>
            {scheduleWeekdays.map((day) => {
              const selected = weekdays.find((w) => w.day === day.day);
              return (
                <div key={day.day} className={styles.weekday}>
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(selected)}
                      onChange={(event) =>
                        setWeekdays((current) =>
                          event.target.checked
                            ? [...current, { day: day.day, stayDays: 2 }]
                            : current.filter((w) => w.day !== day.day),
                        )
                      }
                    />
                    <span>
                      {day.name} <b dir="ltr">{day.code}</b>
                    </span>
                  </label>
                  {mode === 'round-trip' ? (
                    <Input
                      type="number"
                      min={0}
                      max={365}
                      step={1}
                      aria-label={`برگشت چند روز بعد از ${day.name}`}
                      disabled={!selected || saving}
                      value={
                        selected && Number.isFinite(selected.stayDays)
                          ? selected.stayDays
                          : ''
                      }
                      onChange={(event) =>
                        setWeekdays((current) =>
                          current.map((w) =>
                            w.day === day.day
                              ? {
                                  ...w,
                                  stayDays:
                                    event.target.value === ''
                                      ? NaN
                                      : Number(event.target.value),
                                }
                              : w,
                          ),
                        )
                      }
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
          <p className={styles.help}>
            {mode === 'round-trip'
              ? 'عدد زیر هر روز یعنی برگشت چند روز بعد از رفت؛ برگشت‌ها خودکار ساخته می‌شوند.'
              : 'تمام روزهای تیک‌خورده در بازهٔ انتخاب‌شده به بلیت مستقل تبدیل می‌شوند.'}
          </p>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>پرواز</th>
                  <th>مسیر</th>
                  <th>شماره پرواز</th>
                  <th>نوع هواپیما</th>
                  <th>ساعت حرکت</th>
                  <th>ساعت رسیدن</th>
                  <th>روز رسیدن</th>
                  <th>بار مجاز</th>
                  <th>Min روز</th>
                  <th>Max روز</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    'outbound',
                    ...(mode === 'round-trip' ? (['return'] as const) : []),
                  ] as const
                ).map((direction) => {
                  const back = direction === 'return',
                    time = back ? returnTime : outboundTime,
                    changeTime = back ? setReturnTime : setOutboundTime;
                  return (
                    <tr key={direction}>
                      <th scope="row">{back ? 'برگشت' : 'رفت'}</th>
                      <td dir="ltr">
                        {back
                          ? code(segment.destinationAirportId)
                          : code(segment.originAirportId)}{' '}
                        →{' '}
                        {back
                          ? code(segment.originAirportId)
                          : code(segment.destinationAirportId)}
                      </td>
                      <td>
                        <Input
                          dir="ltr"
                          aria-label={`شماره پرواز ${back ? 'برگشت' : 'رفت'}`}
                          required
                          maxLength={20}
                          value={
                            back
                              ? returnDetails.flightNumber
                              : segment.flightNumber
                          }
                          onChange={(event) =>
                            back
                              ? setReturnDetails((c) => ({
                                  ...c,
                                  flightNumber: event.target.value,
                                }))
                              : patchSegment({
                                  flightNumber: event.target.value,
                                })
                          }
                        />
                      </td>
                      <td>
                        {picker(
                          `schedule-aircraft-${direction}`,
                          `هواپیما ${back ? 'برگشت' : 'رفت'}`,
                          'aircraft-types',
                          'aircraft',
                          back ? returnDetails.aircraftId : segment.aircraftId,
                          (r) =>
                            back
                              ? setReturnDetails((c) => ({
                                  ...c,
                                  aircraftId: r?.id ?? '',
                                }))
                              : patchSegment({ aircraftId: r?.id ?? '' }),
                        )}
                      </td>
                      <td>
                        <Input
                          aria-label={`ساعت حرکت ${back ? 'برگشت' : 'رفت'}`}
                          type="time"
                          required
                          value={time.departure}
                          onChange={(event) =>
                            changeTime((c) => ({
                              ...c,
                              departure: event.target.value,
                            }))
                          }
                        />
                      </td>
                      <td>
                        <Input
                          aria-label={`ساعت رسیدن ${back ? 'برگشت' : 'رفت'}`}
                          type="time"
                          required
                          value={time.arrival}
                          onChange={(event) =>
                            changeTime((c) => ({
                              ...c,
                              arrival: event.target.value,
                            }))
                          }
                        />
                      </td>
                      <td>
                        <select
                          aria-label={`روز رسیدن ${back ? 'برگشت' : 'رفت'}`}
                          value={time.arrivalDayOffset}
                          onChange={(event) =>
                            changeTime((c) => ({
                              ...c,
                              arrivalDayOffset: Number(event.target.value),
                            }))
                          }
                        >
                          <option value={0}>همان روز</option>
                          <option value={1}>روز بعد</option>
                          <option value={2}>دو روز بعد</option>
                        </select>
                      </td>
                      <td>
                        <TicketBaggageFields
                          economy={
                            back
                              ? returnDetails.economyBaggageKg
                              : input.economyBaggageKg
                          }
                          business={
                            back
                              ? returnDetails.businessBaggageKg
                              : input.businessBaggageKg
                          }
                          suffix={back ? ' برگشت' : ' رفت'}
                          disabled={saving}
                          onChange={(field, value) =>
                            back
                              ? setReturnDetails((c) => ({
                                  ...c,
                                  [field]: value,
                                }))
                              : setInput((c) => ({ ...c, [field]: value }))
                          }
                        />
                      </td>
                      {(['returnMinDays', 'returnMaxDays'] as const).map(
                        (field) => (
                          <td key={field}>
                            {back || mode === 'one-way' ? (
                              <span>—</span>
                            ) : (
                              <Input
                                aria-label={
                                  field === 'returnMinDays'
                                    ? 'حداقل روز تا برگشت'
                                    : 'حداکثر روز تا برگشت'
                                }
                                placeholder="نامحدود"
                                type="number"
                                min={0}
                                max={365}
                                step={1}
                                value={
                                  field === 'returnMaxDays' &&
                                  !maxEdited &&
                                  weekdays.length > 0 &&
                                  weekdays.every((w) =>
                                    Number.isFinite(w.stayDays),
                                  )
                                    ? defaultReturnMaxDays(
                                        Math.max(
                                          ...weekdays.map((w) => w.stayDays),
                                        ),
                                      )
                                    : (input[field] ?? '')
                                }
                                onChange={(event) => {
                                  if (field === 'returnMaxDays')
                                    setMaxEdited(true);
                                  setInput((c) => ({
                                    ...c,
                                    [field]:
                                      event.target.value === ''
                                        ? null
                                        : Number(event.target.value),
                                  }));
                                }}
                              />
                            )}
                          </td>
                        ),
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className={styles.help}>
            ساعت رفت به وقت {segment.departureZone} و رسیدن به وقت{' '}
            {segment.arrivalZone}؛ برای برگشت برعکس. Min و Max فاصلهٔ روزهای
            مجاز برگشت در فروش هستند. Max پیش‌فرض برای هر رفت، یک روز بیشتر از
            فاصلهٔ برگشت است و می‌توانید آن را تغییر دهید.
          </p>
          <div className={styles.options}>
            <FormField
              label="ظرفیت کلاس انتخاب‌شده در هر پرواز"
              id="schedule-capacity"
              required
            >
              <Input
                id="schedule-capacity"
                type="number"
                min={1}
                max={100000}
                step={1}
                required
                value={input.totalCapacity || ''}
                onChange={(event) =>
                  setInput((c) => ({
                    ...c,
                    totalCapacity: Number(event.target.value),
                  }))
                }
              />
            </FormField>
            {picker(
              'schedule-class',
              'کلاس پرواز',
              'cabin-classes',
              'flightClass',
              input.flightClassId,
              (r) => setInput((c) => ({ ...c, flightClassId: r?.id ?? '' })),
            )}
            <FormField label="نوع تأمین" id="schedule-supply">
              <select
                id="schedule-supply"
                value={input.supplyType}
                onChange={(event) =>
                  setInput((c) => ({
                    ...c,
                    supplyType: event.target
                      .value as ProductInput['supplyType'],
                    companyOwned: event.target.value === 'company',
                    entryMethod:
                      event.target.value === 'supplier' ? 'api' : 'manual',
                  }))
                }
              >
                {Object.entries(supplyOptions).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
            <ManifestTemplatePicker
              value={input.manifestTemplateId ?? null}
              name={input.manifestTemplateName}
              readOnly={saving}
              onChange={(id, name) =>
                setInput((c) => ({
                  ...c,
                  manifestTemplateId: id,
                  manifestTemplateName: name,
                }))
              }
            />
          </div>
          <FlightCabinCapacities
            cabins={additionalCabins}
            primaryCapacity={input.totalCapacity}
            references={references}
            onReference={onReference}
            onChange={setAdditionalCabins}
            roundTrip={mode === 'round-trip'}
            disabled={saving}
          />
          {previewError ? <Alert tone="error" title={previewError} /> : null}
          {preview.length ? (
            <div className={styles.preview}>
              <strong>
                {preview.length.toLocaleString('fa-IR')} بلیت رفت
                {mode === 'round-trip'
                  ? ` و ${returnCount.toLocaleString('fa-IR')} بلیت برگشت`
                  : ''}
              </strong>
              <div className={styles.previewTableScroll}>
                <table className={styles.previewTable}>
                  <thead>
                    <tr>
                      <th>ردیف</th>
                      <th>روز رفت</th>
                      <th>تاریخ رفت</th>
                      <th>روز برگشت</th>
                      <th>تاریخ برگشت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedPreview.map((pair, index) => (
                      <tr
                        key={`${pair.outbound}-${pair.returning ?? 'one-way'}`}
                      >
                        <td>{(index + 1).toLocaleString('fa-IR')}</td>
                        <td>{scheduleWeekdayName(pair.outbound)}</td>
                        <td dir="ltr">{pair.outbound}</td>
                        <td>
                          {pair.returning
                            ? scheduleWeekdayName(pair.returning)
                            : '—'}
                        </td>
                        <td dir="ltr">{pair.returning ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                برگشت‌های هم‌تاریخ با مشخصات یکسان فقط یک‌بار ساخته می‌شوند.
              </p>
            </div>
          ) : null}
          <div className={styles.actions}>
            <Button
              type="submit"
              loading={saving}
              disabled={saving || Boolean(previewError)}
            >
              {saving ? 'در حال ثبت پروازها…' : 'ثبت برنامه و ساخت بلیت‌ها'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={onCancel}
            >
              انصراف
            </Button>
          </div>
        </fieldset>
      ) : (
        <p className={styles.help}>
          ابتدا یک‌طرفه یا رفت‌وبرگشت را انتخاب کنید.
        </p>
      )}
    </form>
  );
}
