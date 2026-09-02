'use client';

import { useState, type FormEvent } from 'react';
import {
  Alert,
  Button,
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/ui';
import {
  wallTimeToUtc,
  type ProductInput,
  type Reference,
  type Segment,
  type TransportType,
} from '../model/catalog';
import { emptyInput, supplyLabels, transportLabels } from '../model/preview';
import styles from './ticket-form.module.css';
import { ReferencePicker } from './reference-picker';
import type { PublishedResource } from '../api/references';

type TicketDefinitionMode = 'one-way' | 'round-trip' | 'combined';

type TransportConfig = {
  operatorKind: Reference['kind'];
  operatorResource: PublishedResource;
  operatorLabel: string;
  vehicleKind: Reference['kind'];
  vehicleResource: PublishedResource;
  vehicleLabel: string;
  numberLabel: string;
};
const transportConfig: Record<TransportType, TransportConfig> = {
  flight: {
    operatorKind: 'airline',
    operatorResource: 'airlines',
    operatorLabel: 'ایرلاین',
    vehicleKind: 'aircraft',
    vehicleResource: 'aircraft-types',
    vehicleLabel: 'نوع هواپیما',
    numberLabel: 'شماره پرواز',
  },
  train: {
    operatorKind: 'railCompany',
    operatorResource: 'rail-companies',
    operatorLabel: 'شرکت ریلی',
    vehicleKind: 'trainType',
    vehicleResource: 'train-types',
    vehicleLabel: 'نوع قطار',
    numberLabel: 'شماره قطار',
  },
  bus: {
    operatorKind: 'busCompany',
    operatorResource: 'bus-companies',
    operatorLabel: 'شرکت اتوبوس‌رانی',
    vehicleKind: 'busType',
    vehicleResource: 'bus-types',
    vehicleLabel: 'نوع اتوبوس',
    numberLabel: 'شماره سرویس',
  },
};

export function createReturnTicketDraft(source: ProductInput): ProductInput {
  const outbound = source.segments[0]!;
  return {
    ...source,
    title: '',
    journeyRole: 'return',
    fare: { ...source.fare },
    segments: [
      {
        ...outbound,
        flightNumber: '',
        originCountryId: outbound.destinationCountryId,
        originCityId: outbound.destinationCityId,
        originAirportId: outbound.destinationAirportId,
        originTerminal: outbound.destinationTerminal,
        destinationCountryId: outbound.originCountryId,
        destinationCityId: outbound.originCityId,
        destinationAirportId: outbound.originAirportId,
        destinationTerminal: outbound.originTerminal,
        departureAt: '',
        arrivalAt: '',
        departureZone: outbound.arrivalZone,
        arrivalZone: outbound.departureZone,
      },
    ],
  };
}

export function createConnectedSegment(source: ProductInput): Segment {
  const previous = source.segments.at(-1)!;
  const fresh = emptyInput(source.transport).segments[0]!;
  return {
    ...fresh,
    originCountryId: previous.destinationCountryId,
    originCityId: previous.destinationCityId,
    originAirportId: previous.destinationAirportId,
    originTerminal: previous.destinationTerminal,
    departureZone: previous.arrivalZone,
  };
}

export function wallValue(utcValue: string, zone: string) {
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
  const delta = Math.round(
    (Date.parse(wallValue(utcValue, zone) + ':00Z') - Date.parse(utcValue)) /
      60000,
  );
  return `${delta >= 0 ? '+' : '-'}${Math.floor(Math.abs(delta) / 60)
    .toString()
    .padStart(2, '0')}:${(Math.abs(delta) % 60).toString().padStart(2, '0')}`;
}
export function inferWallTimeOffset(wallTime: string, zone: string): string {
  const approximate = Date.parse(`${wallTime}:00Z`);
  if (!Number.isFinite(approximate))
    throw new Error('تاریخ و ساعت انتخاب‌شده معتبر نیست.');
  try {
    const candidates = new Set(
      [-86_400_000, 0, 86_400_000].map((shift) =>
        offsetValue(new Date(approximate + shift).toISOString(), zone),
      ),
    );
    for (const candidate of candidates) {
      try {
        wallTimeToUtc(wallTime, zone, candidate);
        return candidate;
      } catch {
        // Try the other side of a daylight-saving transition.
      }
    }
  } catch {
    throw new Error('منطقه زمانی مسیر انتخاب‌شده معتبر نیست.');
  }
  throw new Error(
    'این ساعت در منطقه زمانی مسیر معتبر نیست؛ ساعت دیگری انتخاب کنید.',
  );
}
function referenceLabel(
  references: readonly Reference[],
  kind: Reference['kind'],
  id: string,
  fallback: string,
) {
  const reference = references.find(
    (item) => item.kind === kind && item.id === id,
  );
  return reference?.code || reference?.name || fallback;
}
export function buildAutomaticTicketTitle(
  definition: ProductInput,
  references: readonly Reference[],
): string {
  const first = definition.segments[0]!;
  const last = definition.segments.at(-1)!;
  const origin = first.originAirportId
    ? referenceLabel(references, 'airport', first.originAirportId, 'مبدأ')
    : referenceLabel(
        references,
        'city',
        first.originCityId,
        definition.display?.origin || 'مبدأ',
      );
  const destination = last.destinationAirportId
    ? referenceLabel(references, 'airport', last.destinationAirportId, 'مقصد')
    : referenceLabel(
        references,
        'city',
        last.destinationCityId,
        definition.display?.destination || 'مقصد',
      );
  const number =
    first.flightNumber.trim() || transportLabels[definition.transport];
  const combined = definition.segments.length > 1 ? ' ترکیبی' : '';
  return `${number}${combined} • ${origin} به ${destination}`.slice(0, 160);
}
function withDisplaySnapshot(
  definition: ProductInput,
  references: readonly Reference[],
): ProductInput {
  const segment = definition.segments[0]!;
  const lastSegment = definition.segments.at(-1)!;
  const config = transportConfig[definition.transport];
  return {
    ...definition,
    display: {
      operator: referenceLabel(
        references,
        config.operatorKind,
        segment.airlineId,
        definition.display?.operator || config.operatorLabel,
      ),
      vehicle: referenceLabel(
        references,
        config.vehicleKind,
        segment.aircraftId,
        definition.display?.vehicle || config.vehicleLabel,
      ),
      origin: referenceLabel(
        references,
        'city',
        segment.originCityId,
        definition.display?.origin || 'مبدأ',
      ),
      destination: referenceLabel(
        references,
        'city',
        lastSegment.destinationCityId,
        definition.display?.destination || 'مقصد',
      ),
    },
  };
}

function TransportFields({
  prefix,
  suffix,
  input,
  segment,
  references,
  readOnly,
  showProductFields = true,
  onInput,
  onSegment,
  onReference,
}: {
  prefix: string;
  suffix: string;
  input: ProductInput;
  segment: Segment;
  references: readonly Reference[];
  readOnly: boolean;
  showProductFields?: boolean;
  onInput: (next: ProductInput) => void;
  onSegment: (patch: Partial<Segment>) => void;
  onReference?: ((reference: Reference) => void) | undefined;
}) {
  const config = transportConfig[input.transport];
  return (
    <div className={styles.fields}>
      <ReferencePicker
        id={`${prefix}-operator`}
        label={`${config.operatorLabel}${suffix}`}
        resource={config.operatorResource}
        readOnly={readOnly}
        value={references.find(
          (r) => r.kind === config.operatorKind && r.id === segment.airlineId,
        )}
        onSelect={(ref) => {
          if (ref) onReference?.(ref);
          onSegment({ airlineId: ref?.id ?? '' });
        }}
      />
      <FormField
        label={`${config.numberLabel}${suffix}`}
        id={`${prefix}-number`}
        required
      >
        <Input
          id={`${prefix}-number`}
          dir="ltr"
          value={segment.flightNumber}
          maxLength={20}
          required
          onChange={(event) => onSegment({ flightNumber: event.target.value })}
        />
      </FormField>
      <ReferencePicker
        id={`${prefix}-vehicle`}
        label={`${config.vehicleLabel}${suffix}`}
        resource={config.vehicleResource}
        readOnly={readOnly}
        value={references.find(
          (r) => r.kind === config.vehicleKind && r.id === segment.aircraftId,
        )}
        onSelect={(ref) => {
          if (ref) onReference?.(ref);
          onSegment({ aircraftId: ref?.id ?? '' });
        }}
      />
      {input.transport === 'flight' && showProductFields ? (
        <>
          <ReferencePicker
            id={`${prefix}-flight-class`}
            label={`کلاس پروازی${suffix}`}
            resource="cabin-classes"
            readOnly={readOnly}
            value={references.find(
              (r) => r.kind === 'flightClass' && r.id === input.flightClassId,
            )}
            onSelect={(ref) => {
              if (ref) onReference?.(ref);
              onInput({ ...input, flightClassId: ref?.id ?? '' });
            }}
          />
          <ReferencePicker
            id={`${prefix}-baggage`}
            label={`بار مجاز${suffix}`}
            resource="baggage-rules"
            readOnly={readOnly}
            value={references.find(
              (r) => r.kind === 'baggage' && r.id === input.baggageId,
            )}
            onSelect={(ref) => {
              if (ref) onReference?.(ref);
              onInput({ ...input, baggageId: ref?.id ?? '' });
            }}
          />
        </>
      ) : null}
    </div>
  );
}

function RouteFields({
  prefix,
  suffix,
  input,
  segment,
  references,
  readOnly,
  onSegment,
  onReference,
}: {
  prefix: string;
  suffix: string;
  input: ProductInput;
  segment: Segment;
  references: readonly Reference[];
  readOnly: boolean;
  onSegment: (patch: Partial<Segment>) => void;
  onReference?: ((reference: Reference) => void) | undefined;
}) {
  return (
    <div className={styles.fields}>
      {(['origin', 'destination'] as const).map((end) => {
        const side = end === 'origin' ? 'مبدأ' : 'مقصد';
        const zoneKey = end === 'origin' ? 'departureZone' : 'arrivalZone';
        return (
          <div className="min-w-0 space-y-4" key={`${prefix}-${end}`}>
            <ReferencePicker
              id={`${prefix}-${end}-country`}
              label={`کشور ${side}${suffix}`}
              resource="countries"
              readOnly={readOnly}
              value={references.find(
                (r) =>
                  r.kind === 'country' && r.id === segment[`${end}CountryId`],
              )}
              onSelect={(ref) => {
                if (ref) onReference?.(ref);
                onSegment({
                  [`${end}CountryId`]: ref?.id ?? '',
                  [`${end}CityId`]: '',
                  [`${end}AirportId`]: '',
                  [zoneKey]:
                    input.transport === 'flight' ? 'UTC' : 'Asia/Tehran',
                });
              }}
            />
            <ReferencePicker
              key={segment[`${end}CountryId`]}
              id={`${prefix}-${end}-city`}
              label={`شهر ${side}${suffix}`}
              resource="cities"
              readOnly={readOnly}
              countryId={segment[`${end}CountryId`]}
              value={references.find(
                (r) => r.kind === 'city' && r.id === segment[`${end}CityId`],
              )}
              onSelect={(ref) => {
                if (ref) onReference?.(ref);
                onSegment({
                  [`${end}CityId`]: ref?.id ?? '',
                  [`${end}AirportId`]: '',
                  [zoneKey]:
                    input.transport === 'flight' ? 'UTC' : 'Asia/Tehran',
                });
              }}
            />
            {input.transport === 'flight' ? (
              <ReferencePicker
                key={`${segment[`${end}CityId`]}-airport`}
                id={`${prefix}-${end}-airport`}
                label={`فرودگاه ${side}${suffix}`}
                resource="airports"
                readOnly={readOnly}
                countryId={segment[`${end}CountryId`]}
                cityId={segment[`${end}CityId`]}
                value={references.find(
                  (r) =>
                    r.kind === 'airport' && r.id === segment[`${end}AirportId`],
                )}
                onSelect={(ref) => {
                  if (ref) onReference?.(ref);
                  onSegment({
                    [`${end}AirportId`]: ref?.id ?? '',
                    [zoneKey]: ref?.timezone ?? 'UTC',
                  });
                }}
              />
            ) : (
              <FormField
                label={`${input.transport === 'train' ? 'ایستگاه' : 'پایانه'} ${side}${suffix}`}
                id={`${prefix}-${end}-terminal`}
              >
                <Input
                  id={`${prefix}-${end}-terminal`}
                  value={segment[`${end}Terminal`]}
                  maxLength={160}
                  onChange={(event) =>
                    onSegment({ [`${end}Terminal`]: event.target.value })
                  }
                />
              </FormField>
            )}
          </div>
        );
      })}
    </div>
  );
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
  onReference?: ((reference: Reference) => void) | undefined;
  onSave: (inputs: readonly ProductInput[], reason: string) => void;
  onCancel: () => void;
  readOnly?: boolean;
  allowRoundTrip?: boolean;
}) {
  const [input, setInput] = useState(initial);
  const [definitionMode, setDefinitionMode] = useState<TicketDefinitionMode>(
    initial.segments.length > 1
      ? 'combined'
      : initial.journeyRole === 'one-way'
        ? 'one-way'
        : 'round-trip',
  );
  const [returnInput, setReturnInput] = useState(() =>
    createReturnTicketDraft(initial),
  );
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const segment = input.segments[0]!;
  const returnSegment = returnInput.segments[0]!;
  const changeSegment = (patch: Partial<Segment>) =>
    setInput({ ...input, segments: [{ ...segment, ...patch }] });
  const changeSegmentAt = (index: number, patch: Partial<Segment>) =>
    setInput({
      ...input,
      segments: input.segments.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    });
  const changeReturnSegment = (patch: Partial<Segment>) =>
    setReturnInput({
      ...returnInput,
      segments: [{ ...returnSegment, ...patch }],
    });
  function chooseTransport(transport: TransportType) {
    const fresh = emptyInput(transport);
    const freshSegment = fresh.segments[0]!;
    setInput({
      ...input,
      transport,
      flightClassId: '',
      baggageId: '',
      display: undefined,
      segments: [freshSegment],
    });
    setDefinitionMode('one-way');
    setReturnInput(
      createReturnTicketDraft({
        ...input,
        transport,
        segments: [freshSegment],
      }),
    );
  }
  function chooseDefinitionMode(mode: TicketDefinitionMode) {
    setDefinitionMode(mode);
    if (mode === 'round-trip') {
      const outbound = { ...input, segments: [{ ...input.segments[0]! }] };
      setInput(outbound);
      setReturnInput(createReturnTicketDraft(outbound));
    } else if (mode === 'one-way') {
      setInput({ ...input, segments: [{ ...input.segments[0]! }] });
    } else if (input.segments.length === 1) {
      setInput({
        ...input,
        segments: [...input.segments, createConnectedSegment(input)],
      });
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const roundTrip = definitionMode === 'round-trip' && allowRoundTrip;
      const groupId = roundTrip ? crypto.randomUUID() : undefined;
      const baseDefinition: ProductInput = {
        ...input,
        journeyRole: roundTrip
          ? 'outbound'
          : allowRoundTrip
            ? 'one-way'
            : input.journeyRole,
        ...(roundTrip
          ? { tripGroupId: groupId }
          : allowRoundTrip
            ? { tripGroupId: undefined }
            : {}),
        segments: input.segments.map((item) => ({ ...item })),
        fare: { ...input.fare },
      };
      const definition = withDisplaySnapshot(
        {
          ...baseDefinition,
          title: buildAutomaticTicketTitle(baseDefinition, references),
        },
        references,
      );
      if (roundTrip) {
        const returnBase: ProductInput = {
          ...returnInput,
          transport: definition.transport,
          journeyRole: 'return',
          tripGroupId: groupId,
          supplyType: definition.supplyType,
          companyOwned: definition.companyOwned,
          entryMethod: definition.entryMethod,
          totalCapacity: definition.totalCapacity,
          rules: definition.rules,
          fare: { ...definition.fare },
          segments: [{ ...returnSegment }],
        };
        const returnDefinition = withDisplaySnapshot(
          {
            ...returnBase,
            title: buildAutomaticTicketTitle(returnBase, references),
          },
          references,
        );
        onSave([definition, returnDefinition], reason);
      } else onSave([definition], reason);
      setError('');
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : 'اطلاعات فرم معتبر نیست.',
      );
    }
  }
  return (
    <form onSubmit={submit} className={`${styles.form} space-y-6`}>
      {error ? <Alert tone="error" title={error} /> : null}
      <fieldset disabled={readOnly} className="space-y-6 disabled:opacity-80">
        <section className="space-y-4">
          <h3 className="font-bold text-primary">۱. نوع بلیت</h3>
          <div className={styles.fields}>
            <FormField label="نوع وسیله سفر" id="ticket-transport" required>
              <Select
                value={input.transport}
                onValueChange={(value) =>
                  chooseTransport(value as TransportType)
                }
              >
                <SelectTrigger id="ticket-transport">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {Object.entries(transportLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            {allowRoundTrip ? (
              <FormField label="مسیر فروش" id="ticket-definition-mode" required>
                <Select
                  value={definitionMode}
                  onValueChange={(mode) =>
                    chooseDefinitionMode(mode as TicketDefinitionMode)
                  }
                >
                  <SelectTrigger id="ticket-definition-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="one-way">یک‌طرفه</SelectItem>
                    <SelectItem value="round-trip">رفت‌وبرگشت</SelectItem>
                    <SelectItem value="combined">ترکیبی / چندمسیره</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            ) : null}
          </div>
          {allowRoundTrip ? (
            <p className="text-xs leading-6 text-muted-foreground">
              رفت‌وبرگشت دو بلیت مستقل می‌سازد. ترکیبی یک بلیت واحد با چند قطعه
              متصل است و همه قطعه‌ها با هم فروخته می‌شوند.
            </p>
          ) : null}
        </section>
        {definitionMode !== 'combined' ? (
          <section className="space-y-4">
            <h3 className="font-bold text-primary">
              ۲. مشخصات حرکت {definitionMode === 'round-trip' ? 'رفت' : ''}
            </h3>
            <TransportFields
              prefix="ticket"
              suffix=""
              input={input}
              segment={segment}
              references={references}
              readOnly={readOnly}
              onInput={setInput}
              onSegment={changeSegment}
              onReference={onReference}
            />
            <h4 className="font-semibold">مسیر</h4>
            <RouteFields
              prefix="ticket"
              suffix=""
              input={input}
              segment={segment}
              references={references}
              readOnly={readOnly}
              onSegment={changeSegment}
              onReference={onReference}
            />
          </section>
        ) : (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-primary">
                  ۲. قطعه‌های بلیت ترکیبی
                </h3>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">
                  مقصد هر قطعه باید مبدأ قطعه بعدی باشد. این قطعه‌ها یک بلیت
                  واحد هستند.
                </p>
              </div>
              {!readOnly && input.segments.length < 8 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setInput({
                      ...input,
                      segments: [
                        ...input.segments,
                        createConnectedSegment(input),
                      ],
                    })
                  }
                >
                  افزودن قطعه
                </Button>
              ) : null}
            </div>
            {input.segments.map((item, index) => (
              <div
                key={'combined-segment-' + index}
                className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <h4 className="font-bold">
                    قطعه {(index + 1).toLocaleString('fa-IR')}
                  </h4>
                  {!readOnly && input.segments.length > 2 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setInput({
                          ...input,
                          segments: input.segments.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        })
                      }
                    >
                      حذف قطعه
                    </Button>
                  ) : null}
                </div>
                <TransportFields
                  prefix={'ticket-segment-' + index}
                  suffix={' قطعه ' + (index + 1).toLocaleString('fa-IR')}
                  input={input}
                  segment={item}
                  references={references}
                  readOnly={readOnly}
                  showProductFields={index === 0}
                  onInput={setInput}
                  onSegment={(patch) => changeSegmentAt(index, patch)}
                  onReference={onReference}
                />
                <RouteFields
                  prefix={'ticket-segment-' + index}
                  suffix={' قطعه ' + (index + 1).toLocaleString('fa-IR')}
                  input={input}
                  segment={item}
                  references={references}
                  readOnly={readOnly}
                  onSegment={(patch) => changeSegmentAt(index, patch)}
                  onReference={onReference}
                />
              </div>
            ))}
          </section>
        )}
        {definitionMode === 'round-trip' && allowRoundTrip ? (
          <section className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <h3 className="font-bold text-primary">۳. مشخصات حرکت برگشت</h3>
            <TransportFields
              prefix="ticket-return"
              suffix=" برگشت"
              input={returnInput}
              segment={returnSegment}
              references={references}
              readOnly={readOnly}
              onInput={setReturnInput}
              onSegment={changeReturnSegment}
              onReference={onReference}
            />
            <RouteFields
              prefix="ticket-return"
              suffix=" برگشت"
              input={returnInput}
              segment={returnSegment}
              references={references}
              readOnly={readOnly}
              onSegment={changeReturnSegment}
              onReference={onReference}
            />
          </section>
        ) : null}
        <section className="space-y-4">
          <h3 className="font-bold text-primary">۴. تأمین و ظرفیت</h3>
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
              <Select
                value={input.supplyType}
                onValueChange={(supplyType) =>
                  setInput({
                    ...input,
                    supplyType: supplyType as ProductInput['supplyType'],
                    companyOwned: supplyType === 'company',
                  })
                }
              >
                <SelectTrigger id="ticket-supply">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {Object.entries(supplyLabels).map(([key, label]) => (
                    <SelectItem value={key} key={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="روش ورود" id="ticket-entry">
              <Select
                value={input.entryMethod}
                onValueChange={(entryMethod) =>
                  setInput({
                    ...input,
                    entryMethod: entryMethod as ProductInput['entryMethod'],
                  })
                }
              >
                <SelectTrigger id="ticket-entry">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="manual">دستی</SelectItem>
                  <SelectItem value="api" disabled>
                    API
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="ظرفیت کل" id="ticket-capacity">
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
        </section>
        <section className="space-y-4">
          <h3 className="font-bold text-primary">۵. قیمت خرید</h3>
          <p className="text-sm text-muted-foreground">
            قیمت فروش هنگام فروش تعیین می‌شود.
          </p>
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
                ['fee', 'کارمزد'],
                ['commission', 'کمیسیون'],
              ] as const
            ).map(([key, label]) => (
              <FormField label={label} key={key} id={`ticket-${key}`}>
                <Input
                  id={`ticket-${key}`}
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
          </div>
        </section>
        <section className="space-y-4">
          <h3 className="font-bold text-primary">۶. شرایط بلیت</h3>
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
          <FormField label="یادداشت تغییر" id="ticket-reason">
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
          <Button type="submit">
            {definitionMode === 'round-trip' && allowRoundTrip
              ? 'ذخیره دو بلیت رفت و برگشت'
              : definitionMode === 'combined'
                ? 'ذخیره بلیت ترکیبی'
                : 'ذخیره بلیت'}
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={onCancel}>
          بستن فرم
        </Button>
      </div>
    </form>
  );
}
