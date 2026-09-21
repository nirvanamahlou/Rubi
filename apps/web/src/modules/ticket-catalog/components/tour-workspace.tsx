'use client';
import { useEffect, useRef, useState } from 'react';
import type {
  BranchReference,
  MasterDataRecord,
  MasterDataResource,
  TicketOfferCreateV1,
  TicketOfferV1,
  TourDepartureV1,
  TourPackageInputV1,
  TourPackageV1,
} from '@nora/contracts';
import {
  Button,
  Card,
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { masterDataApi } from '@/modules/master-data/api/client';
import { toursApi } from '../api/tours';
import { TicketDatePicker } from './ticket-date-picker';
import { TourDetailsForm } from './tour-details-form';

const emptyPackage: TourPackageInputV1 = {
  name: '',
  originId: '',
  destinationId: '',
  hotelIds: [],
  transferOutbound: false,
  transferReturn: false,
  visa: false,
};
function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; name: string }[];
  onChange: (value: string) => void;
}) {
  const [search, setSearch] = useState('');
  return (
    <div className="grid gap-1">
      <span className="text-sm font-semibold">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue placeholder="انتخاب کنید" />
        </SelectTrigger>
        <SelectContent>
          <Input
            aria-label={`جست‌وجوی ${label}`}
            placeholder="جست‌وجو…"
            value={search}
            onKeyDown={(event) => event.stopPropagation()}
            onChange={(event) => setSearch(event.target.value)}
          />
          {options
            .filter((item) =>
              item.name.toLowerCase().includes(search.toLowerCase()),
            )
            .map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}
const shiftWeek = (value: string) => {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString().slice(0, 10);
};
const timeLabel = (offer: TicketOfferV1) =>
  `${offer.carrierName} · ${offer.serviceNumber} · ${new Date(offer.departureAt).toLocaleTimeString('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit' })} · ${offer.remainingCapacity} صندلی`;

export function TourWorkspace({
  mode = 'definition',
}: {
  mode?: 'definition' | 'departures';
}) {
  const [packages, setPackages] = useState<TourPackageV1[]>([]);
  const [departures, setDepartures] = useState<TourDepartureV1[]>([]);
  const [branches, setBranches] = useState<BranchReference[]>([]);
  const [branch, setBranch] = useState('');
  const [references, setReferences] = useState<{
    cities: MasterDataRecord[];
    insurance: MasterDataRecord[];
    airlines: MasterDataRecord[];
    airports: MasterDataRecord[];
  }>({
    cities: [],
    insurance: [],
    airlines: [],
    airports: [],
  });
  const [draft, setDraft] = useState<TourPackageInputV1>(emptyPackage);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState('');
  const [repeatSource, setRepeatSource] = useState<TourDepartureV1>();
  const [dates, setDates] = useState({ start: '', end: '' });
  const [outbound, setOutbound] = useState('');
  const [returning, setReturning] = useState('');
  const [roundtrip, setRoundtrip] = useState(true);
  const [offers, setOffers] = useState<{
    out: TicketOfferV1[];
    back: TicketOfferV1[];
  }>({ out: [], back: [] });
  const [flight, setFlight] = useState<{
    direction: 'out' | 'back';
    draft: TicketOfferCreateV1;
  }>();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const attempts = useRef(new Map<string, string>());
  const pack = packages.find((item) => item.id === selected);
  const keyFor = (kind: string, payload: unknown) => {
    const fingerprint = JSON.stringify([kind, branch, payload]);
    if (!attempts.current.has(fingerprint))
      attempts.current.set(fingerprint, crypto.randomUUID());
    return attempts.current.get(fingerprint)!;
  };
  useEffect(() => {
    let cancelled = false;
    const loadRefs = async (resource: MasterDataResource) => {
      const rows: MasterDataRecord[] = [];
      for (let page = 1; ; page++) {
        const result = await masterDataApi.list(resource, {
          search: '',
          status: 'active',
          sortBy: 'name',
          sortDirection: 'asc',
          page,
          pageSize: 100,
        });
        rows.push(...result.data);
        if (!result.data.length || rows.length >= result.meta.total)
          return rows;
      }
    };
    void (async () => {
      const base = getPublicApiBaseUrl();
      if (!base) throw new Error('نشانی سرور تنظیم نشده است.');
      const session = await refreshAuthenticatedSession(base);
      if (!session) throw new Error('برای مدیریت تور وارد حساب شوید.');
      const [p, d, cities, insurance, airlines, airports] = await Promise.all([
        toursApi.packages(),
        toursApi.departures(),
        loadRefs('cities'),
        loadRefs('insurance-plans'),
        loadRefs('airlines'),
        loadRefs('airports'),
      ]);
      if (cancelled) return;
      setPackages(p.data);
      setDepartures(d.data);
      setReferences({
        cities,
        insurance,
        airlines,
        airports,
      });
      setBranches(session.user.branches);
      if (session.user.branches.length === 1)
        setBranch(session.user.branches[0]!.id);
    })().catch((error: unknown) => {
      if (!cancelled)
        setProblem(
          error instanceof Error ? error.message : 'بارگذاری ناموفق بود.',
        );
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    if (!pack || !dates.start || !dates.end) return;
    void Promise.all([
      toursApi.offers(pack.originId, pack.destinationId, dates.start),
      roundtrip
        ? toursApi.offers(pack.destinationId, pack.originId, dates.end)
        : Promise.resolve([]),
    ])
      .then(([out, back]) => {
        if (!cancelled)
          setOffers({
            out: out.filter((o) => o.branchId === pack.branchId),
            back: back.filter((o) => o.branchId === pack.branchId),
          });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setProblem(
            error instanceof Error ? error.message : 'دریافت بلیط ناموفق بود.',
          );
      });
    return () => {
      cancelled = true;
    };
  }, [pack, dates, roundtrip, reload]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setProblem('');
    setNotice('');
    try {
      await action();
      setReload((value) => value + 1);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'ثبت ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };
  const resetTickets = () => {
    setOutbound('');
    setReturning('');
    setOffers({ out: [], back: [] });
    setFlight(undefined);
  };
  const newFlight = (direction: 'out' | 'back') => {
    if (!pack) return;
    const day = direction === 'out' ? dates.start : dates.end;
    if (!day) {
      setProblem('ابتدا تاریخ برگزاری را انتخاب کنید.');
      return;
    }
    const source =
      repeatSource?.packageId === pack.id
        ? direction === 'out'
          ? repeatSource.outbound
          : repeatSource.returning
        : undefined;
    const previousDay =
      direction === 'out' ? repeatSource?.startsOn : repeatSource?.endsOn;
    const offset = previousDay
      ? new Date(day).getTime() - new Date(previousDay).getTime()
      : 0;
    setFlight({
      direction,
      draft: {
        originId: direction === 'out' ? pack.originId : pack.destinationId,
        destinationId: direction === 'out' ? pack.destinationId : pack.originId,
        departureAt: source
          ? new Date(
              new Date(source.departureAt).getTime() + offset,
            ).toISOString()
          : `${day}T08:00:00.000Z`,
        arrivalAt: source
          ? new Date(
              new Date(source.arrivalAt).getTime() + offset,
            ).toISOString()
          : `${day}T11:00:00.000Z`,
        carrierName: source?.carrierName ?? '',
        serviceNumber: source?.serviceNumber ?? '',
        cabinClassCode: source?.cabinClassCode ?? 'ECONOMY',
        totalCapacity: source?.totalCapacity ?? 0,
      },
    });
  };
  const patchFlight = (patch: Partial<TicketOfferCreateV1>) =>
    setFlight((current) =>
      current ? { ...current, draft: { ...current.draft, ...patch } } : current,
    );

  return (
    <div className="space-y-5" dir="rtl">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="text-lg font-bold">
            {mode === 'definition'
              ? 'تعریف تور و خدمات'
              : 'نوبت برگزاری تور و بلیط‌ها'}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {mode === 'definition'
              ? 'اینجا فقط مشخصات ثابت و خدمات تور ثبت می‌شود. تاریخ، بلیط و هتل هر نوبت در مدیریت قیمت پکیج تعیین می‌شوند.'
              : 'تاریخ هر نوبت و بلیط‌های واقعی رفت‌وبرگشت را انتخاب کنید؛ سپس هتل‌های همان بازه را متصل کنید.'}
          </p>
        </div>
        {mode === 'definition' ? (
          <Button size="sm" onClick={() => setCreating(!creating)}>
            {creating ? 'بستن فرم' : 'تعریف تور جدید'}
          </Button>
        ) : null}
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => setReload((value) => value + 1)}
        >
          به‌روزرسانی
        </Button>
      </Card>
      {problem && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4"
        >
          {problem}
        </div>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-primary/10 p-4">
          {notice}
        </p>
      )}
      {mode === 'definition' && creating && (
        <Card className="space-y-3 p-4">
          <h3 className="font-bold">مشخصات و خدمات تور</h3>
          <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
            <FormField id="tour-name" label="عنوان تور">
              <Input
                id="tour-name"
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
              />
            </FormField>
            <Choice
              label="شعبه"
              value={branch}
              options={branches}
              onChange={setBranch}
            />
            <Choice
              label="شهر مبدأ"
              value={draft.originId}
              options={references.cities}
              onChange={(originId) => {
                const details = {
                  ...(draft.details ?? { version: 1 as const }),
                };
                delete details.originAirportCode;
                setDraft({ ...draft, originId, details });
              }}
            />
            <Choice
              label="شهر مقصد"
              value={draft.destinationId}
              options={references.cities}
              onChange={(destinationId) =>
                setDraft({ ...draft, destinationId, hotelIds: [] })
              }
            />
            <Choice
              label="بیمه همراه تور"
              value={draft.insuranceId ?? 'none'}
              options={[
                { id: 'none', name: 'بدون بیمه' },
                ...references.insurance,
              ]}
              onChange={(insuranceId) =>
                setDraft((current) => {
                  const next = { ...current };
                  if (insuranceId === 'none') delete next.insuranceId;
                  else next.insuranceId = insuranceId;
                  return next;
                })
              }
            />
            <div className="flex flex-wrap items-center gap-4">
              {(
                [
                  ['transferOutbound', 'ترانسفر رفت'],
                  ['transferReturn', 'ترانسفر برگشت'],
                  ['visa', 'ویزا'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex gap-2">
                  <input
                    type="checkbox"
                    checked={draft[key]}
                    onChange={(event) =>
                      setDraft({ ...draft, [key]: event.target.checked })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <TourDetailsForm
              value={draft.details ?? { version: 1 }}
              onChange={(details) => setDraft({ ...draft, details })}
              airlines={references.airlines}
              airports={references.airports.filter(
                (airport) => airport.attributes.cityId === draft.originId,
              )}
              branches={branches}
              branchId={branch}
            />
            <Button
              disabled={!branch}
              onClick={() =>
                void run(async () => {
                  const result = await toursApi.createPackage(
                    draft,
                    branch,
                    keyFor('package', draft),
                  );
                  setSelected(result.data.id);
                  setCreating(false);
                  setDraft(emptyPackage);
                  resetTickets();
                  setNotice(
                    'تور و خدمات آن ذخیره شد. نوبت برگزاری، بلیط‌ها و هتل‌های بازه را در مدیریت قیمت پکیج ثبت کنید.',
                  );
                })
              }
            >
              ذخیره تعریف تور
            </Button>
          </fieldset>
        </Card>
      )}
      {mode === 'definition' ? (
        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold">تورهای تعریف‌شده</h3>
              <p className="text-xs text-muted-foreground">
                برای ساخت تاریخ برگزاری و اتصال بلیط و هتل، وارد مدیریت قیمت
                پکیج شوید.
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <a href="/sales/pricing">مدیریت نوبت و قیمت پکیج</a>
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {packages.map((item) => (
              <article
                className="rounded-xl border bg-muted/20 p-3"
                key={item.id}
              >
                <strong className="text-sm">{item.name}</strong>
                <p className="mt-1 text-xs text-muted-foreground">
                  {references.cities.find((city) => city.id === item.originId)
                    ?.name ?? 'مبدأ'}{' '}
                  ←{' '}
                  {references.cities.find(
                    (city) => city.id === item.destinationId,
                  )?.name ?? 'مقصد'}
                </p>
                <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                  {item.transferOutbound ? (
                    <span className="rounded-full bg-primary/10 px-2 py-1">
                      ترانسفر رفت
                    </span>
                  ) : null}
                  {item.transferReturn ? (
                    <span className="rounded-full bg-primary/10 px-2 py-1">
                      ترانسفر برگشت
                    </span>
                  ) : null}
                  {item.visa ? (
                    <span className="rounded-full bg-primary/10 px-2 py-1">
                      ویزا
                    </span>
                  ) : null}
                  {item.insuranceId ? (
                    <span className="rounded-full bg-primary/10 px-2 py-1">
                      بیمه
                    </span>
                  ) : null}
                </div>
              </article>
            ))}
            {!packages.length ? (
              <p className="text-sm text-muted-foreground">
                هنوز توری تعریف نشده است.
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}
      <Card className={mode === 'departures' ? 'space-y-4 p-5' : 'hidden'}>
        <h3 className="font-bold">نوبت برگزاری و بلیط‌ها</h3>
        <fieldset disabled={busy} className="space-y-4">
          <Choice
            label="تور"
            value={selected}
            options={packages}
            onChange={(id) => {
              setSelected(id);
              resetTickets();
            }}
          />
          {pack && (
            <>
              {pack.details && (
                <details className="rounded-xl border bg-primary/5 p-4">
                  <summary className="cursor-pointer font-semibold">
                    مشخصات و برنامه سفر {pack.name}
                  </summary>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ['خلاصه', pack.details.summary],
                      ['معرفی', pack.details.description],
                      ['مدارک لازم', pack.details.requiredDocuments],
                      ['خدمات', pack.details.services],
                      ['شرایط اقساط', pack.details.installmentTerms],
                      ['قوانین استرداد', pack.details.refundRules],
                      ['مدت سفر (روز)', pack.details.durationDays],
                      ['امتیاز', pack.details.rating],
                      ['مبدأ فرودگاهی', pack.details.originAirportCode],
                      ['ایرلاین', pack.details.airlineName],
                      [
                        'قیمت پایه',
                        pack.details.basePrice
                          ? `${pack.details.basePrice.amount} ${pack.details.basePrice.currency}`
                          : undefined,
                      ],
                      [
                        'هزینه جداگانه پرواز',
                        pack.details.flightPrice
                          ? `${pack.details.flightPrice.amount} ${pack.details.flightPrice.currency}`
                          : undefined,
                      ],
                    ].map(
                      ([label, value]) =>
                        value !== undefined && (
                          <div key={String(label)}>
                            <b>{label}: </b>
                            <span className="whitespace-pre-wrap">{value}</span>
                          </div>
                        ),
                    )}
                  </div>
                  <ol className="mt-4 space-y-2">
                    {pack.details.itinerary?.map((step, index) => (
                      <li
                        key={index}
                        className="rounded-lg border bg-surface p-3"
                      >
                        <b>
                          مرحله {index + 1}: {step.title}
                        </b>
                        <div className="flex flex-wrap gap-3 text-sm">
                          <span>{step.location}</span>
                          {step.startTime && (
                            <span>
                              شروع: <bdi>{step.startTime}</bdi>
                            </span>
                          )}
                          {step.stayDays !== undefined && (
                            <span>اقامت: {step.stayDays} روز</span>
                          )}
                          {step.durationMinutes !== undefined && (
                            <span>{step.durationMinutes} دقیقه</span>
                          )}
                          <span>{step.transport}</span>
                          <span>{step.cabinClass}</span>
                          {step.baggageKg !== undefined && (
                            <span>بار: {step.baggageKg} کیلوگرم</span>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap text-sm">
                          {step.description}
                        </p>
                      </li>
                    ))}
                  </ol>
                  {pack.details.imageDocumentId && (
                    <a
                      className="mt-3 block text-primary underline"
                      target="_blank"
                      rel="noreferrer"
                      href={`/documents?document=${encodeURIComponent(pack.details.imageDocumentId)}`}
                    >
                      مشاهده تصویر تور در آرشیو
                    </a>
                  )}
                </details>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="روز شروع">
                  <TicketDatePicker
                    value={dates.start}
                    onChange={(start) => {
                      setDates({ ...dates, start });
                      resetTickets();
                    }}
                  />
                </FormField>
                <FormField label="روز پایان">
                  <TicketDatePicker
                    value={dates.end}
                    onChange={(end) => {
                      setDates({ ...dates, end });
                      resetTickets();
                    }}
                  />
                </FormField>
              </div>
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={roundtrip}
                  onChange={(event) => {
                    setRoundtrip(event.target.checked);
                    resetTickets();
                  }}
                />
                تور بلیط برگشت هم دارد
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  ['out', ...(roundtrip ? ['back'] : [])] as ('out' | 'back')[]
                ).map((direction) => (
                  <div
                    key={direction}
                    className="space-y-3 rounded-xl border p-4"
                  >
                    <Choice
                      label={direction === 'out' ? 'بلیط رفت' : 'بلیط برگشت'}
                      value={direction === 'out' ? outbound : returning}
                      options={offers[direction].map((offer) => ({
                        id: offer.id,
                        name: timeLabel(offer),
                      }))}
                      onChange={
                        direction === 'out' ? setOutbound : setReturning
                      }
                    />
                    <Button
                      variant="outline"
                      onClick={() => newFlight(direction)}
                    >
                      تعریف بلیط برای این روز
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      بلیط جدید در فروش تکی هم قابل انتخاب است و ظرفیت مشترک
                      دارد.
                    </p>
                  </div>
                ))}
              </div>
              {flight && (
                <div className="space-y-3 rounded-xl bg-primary/5 p-4">
                  <h4 className="font-bold">
                    بلیط واقعی {flight.direction === 'out' ? 'رفت' : 'برگشت'} —
                    زمان‌ها به وقت تهران
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField id="tour-airline" label="نام ایرلاین">
                      <Input
                        id="tour-airline"
                        value={flight.draft.carrierName}
                        onChange={(event) =>
                          patchFlight({ carrierName: event.target.value })
                        }
                      />
                    </FormField>
                    <FormField id="tour-flight-number" label="شماره پرواز">
                      <Input
                        id="tour-flight-number"
                        value={flight.draft.serviceNumber}
                        onChange={(event) =>
                          patchFlight({ serviceNumber: event.target.value })
                        }
                      />
                    </FormField>
                    <FormField label="حرکت">
                      <TicketDatePicker
                        includeTime
                        value={flight.draft.departureAt}
                        onChange={(departureAt) => patchFlight({ departureAt })}
                      />
                    </FormField>
                    <FormField label="رسیدن">
                      <TicketDatePicker
                        includeTime
                        value={flight.draft.arrivalAt}
                        onChange={(arrivalAt) => patchFlight({ arrivalAt })}
                      />
                    </FormField>
                    <FormField
                      id="tour-flight-capacity"
                      label="ظرفیت خریداری‌شده"
                    >
                      <Input
                        id="tour-flight-capacity"
                        type="number"
                        min={0}
                        step={1}
                        value={flight.draft.totalCapacity}
                        onChange={(event) =>
                          patchFlight({
                            totalCapacity: Number(event.target.value),
                          })
                        }
                      />
                    </FormField>
                    <Choice
                      label="کلاس پرواز"
                      value={flight.draft.cabinClassCode}
                      options={[
                        { id: 'ECONOMY', name: 'اکونومی' },
                        { id: 'BUSINESS', name: 'بیزینس' },
                        { id: 'FIRST', name: 'فرست' },
                      ]}
                      onChange={(value) =>
                        patchFlight({
                          cabinClassCode:
                            value as TicketOfferCreateV1['cabinClassCode'],
                        })
                      }
                    />
                  </div>
                  <Button
                    onClick={() =>
                      void run(async () => {
                        const result = await toursApi.publishOffer(
                          flight.draft,
                          pack.branchId,
                          keyFor('offer', flight.draft),
                        );
                        if (flight.direction === 'out')
                          setOutbound(result.data.id);
                        else setReturning(result.data.id);
                        setFlight(undefined);
                        setNotice(
                          'بلیط واقعی ثبت شد؛ برای ذخیره نوبت تور تأیید نهایی را بزنید.',
                        );
                      })
                    }
                  >
                    ثبت بلیط قابل فروش
                  </Button>
                </div>
              )}
              <p className="rounded-lg bg-primary/5 p-3 text-sm">
                ظرفیت تور از بلیط‌ها محاسبه می‌شود؛ ثبت نوبت به‌تنهایی صندلی را
                رزرو نمی‌کند. فروش تکی و تور از همان موجودی کم می‌شوند.
              </p>
              <Button
                disabled={
                  !outbound ||
                  (roundtrip && !returning) ||
                  !dates.start ||
                  !dates.end
                }
                onClick={() =>
                  void run(async () => {
                    const input = {
                      packageId: pack.id,
                      packageVersion: pack.version,
                      startsOn: dates.start,
                      endsOn: dates.end,
                      outboundOfferId: outbound,
                      ...(roundtrip ? { returnOfferId: returning } : {}),
                    };
                    await toursApi.createDeparture(
                      input,
                      pack.branchId,
                      keyFor('departure', input),
                    );
                    setNotice('نوبت تور ثبت شد.');
                    resetTickets();
                  })
                }
              >
                ثبت نوبت برگزاری
              </Button>
            </>
          )}
          {!packages.length && (
            <p className="text-sm text-muted-foreground">
              برای شروع، یک تعریف تور بسازید.
            </p>
          )}
        </fieldset>
      </Card>
      <Card className={mode === 'departures' ? 'space-y-3 p-5' : 'hidden'}>
        <h3 className="font-bold">نوبت‌های آینده</h3>
        {departures.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
          >
            <div>
              <strong>{item.package.name}</strong>
              <p className="text-sm">
                <bdi>{item.startsOn}</bdi> تا <bdi>{item.endsOn}</bdi> ·{' '}
                {item.remainingCapacity} صندلی باقی‌مانده
              </p>
              <p className="text-xs text-muted-foreground">
                {item.outbound.serviceNumber}
                {item.returning ? ` / ${item.returning.serviceNumber}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setSelected(item.packageId);
                  setRepeatSource(item);
                  setDates({
                    start: shiftWeek(item.startsOn),
                    end: shiftWeek(item.endsOn),
                  });
                  setRoundtrip(Boolean(item.returning));
                  resetTickets();
                  setNotice(
                    'تاریخ‌ها یک هفته جلو رفتند؛ بلیط‌های همین تاریخ را انتخاب یا با ساعت دلخواه تعریف کنید. نوبت قبلی تغییر نکرده است.',
                  );
                }}
              >
                تکرار برای هفتهٔ بعد
              </Button>
              <Button asChild size="sm">
                <a
                  href={`/reservations/hotel-rates?tourDepartureId=${encodeURIComponent(item.id)}`}
                >
                  اتصال هتل‌های این بازه
                </a>
              </Button>
            </div>
          </div>
        ))}
        {!departures.length && (
          <p className="text-sm text-muted-foreground">
            هنوز نوبتی ثبت نشده است.
          </p>
        )}
      </Card>
    </div>
  );
}
