'use client';
import { useEffect, useRef, useState } from 'react';
import type { TicketOfferV1 } from '@nora/contracts';
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
} from '@/components/ui';
import { toursApi } from '../api/tours';
import { asReference, listReferences } from '../api/references';
import { wallTimeToUtc, type Reference } from '../model/catalog';
import {
  arrivalWallTimeAfterDepartureChange,
  arrivalWallTimeAfterMidnight,
  publishedOfferInput,
} from '../model/published-catalog';
import { TicketDatePicker } from './ticket-date-picker';
import { ManifestTemplatePicker } from './manifest-template-picker';
import {
  loadWeekdayRevisions,
  loadWeekdayMoveRevisions,
  offerWeekday,
  weekdayMoveDays,
} from '../model/load-weekday-edit';
import { scheduleWeekdays } from '../model/weekday-schedule';
import { TicketBaggageFields } from './ticket-baggage-fields';
import { ReferencePicker } from './reference-picker';
export function tehranWallTime(instant: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant));
  const get = (kind: string) => parts.find((part) => part.type === kind)!.value;
  return (
    get('year') +
    '-' +
    get('month') +
    '-' +
    get('day') +
    'T' +
    get('hour') +
    ':' +
    get('minute')
  );
}
export function PublishedOfferForm({
  offer,
  readOnly,
  onSaved,
  weekdayOffers,
}: {
  offer: TicketOfferV1;
  readOnly: boolean;
  onSaved: () => Promise<void>;
  weekdayOffers?: readonly TicketOfferV1[] | undefined;
}) {
  const initialDeparture = tehranWallTime(offer.departureAt);
  const initialArrival = arrivalWallTimeAfterMidnight(
    initialDeparture,
    tehranWallTime(offer.arrivalAt),
  );
  const [draft, setDraft] = useState(publishedOfferInput(offer));
  const [airline, setAirline] = useState<Reference | undefined>({
    id: `registered-carrier:${offer.id}`,
    kind: 'airline',
    name: offer.carrierName,
    active: true,
  });
  const [departure, setDeparture] = useState(initialDeparture);
  const [arrival, setArrival] = useState(initialArrival);
  const [cities, setCities] = useState<Reference[]>([]);
  const [problem, setProblem] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [targetWeekday, setTargetWeekday] = useState(
    offerWeekday(offer.departureAt),
  );
  const shiftDays = weekdayMoveDays(offer.departureAt, targetWeekday);

  async function moveWeekday() {
    if (readOnly || savingRef.current || !weekdayOffers || !shiftDays) return;
    savingRef.current = true;
    setSaving(true);
    setProblem('');
    try {
      await toursApi.reviseOfferBatch(
        loadWeekdayMoveRevisions(offer, weekdayOffers, targetWeekday),
      );
      await onSaved();
    } catch (error) {
      setProblem(
        error instanceof Error ? error.message : 'ویرایش بلیط ناموفق بود.',
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function changeDeparture(value: string) {
    setDeparture(value);
    setArrival((current) =>
      arrivalWallTimeAfterDepartureChange(value, current),
    );
    setProblem('');
  }

  function changeArrival(value: string) {
    setArrival(arrivalWallTimeAfterMidnight(departure, value));
    setProblem('');
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rows: Reference[] = [];
      for (let page = 1; page <= 100; page++) {
        const result = await listReferences('cities', '', page);
        rows.push(
          ...result.data.flatMap((record) => {
            const reference = asReference(record);
            return reference ? [reference] : [];
          }),
        );
        if (page * result.meta.pageSize >= result.meta.total) break;
      }
      if (!cancelled) setCities(rows);
    })().catch(() => {
      if (!cancelled)
        setProblem(
          'دریافت شهرها ناموفق بود؛ برای تغییر مسیر دوباره فرم را باز کنید.',
        );
    });
    return () => {
      cancelled = true;
    };
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (readOnly || savingRef.current || !draft.carrierName.trim()) return;
    savingRef.current = true;
    setSaving(true);
    setProblem('');
    try {
      const departureAt =
        departure === tehranWallTime(offer.departureAt)
          ? offer.departureAt
          : wallTimeToUtc(departure, 'Asia/Tehran', '+03:30');
      const adjustedArrival = arrivalWallTimeAfterMidnight(departure, arrival);
      if (adjustedArrival !== arrival) setArrival(adjustedArrival);
      const arrivalAt =
        adjustedArrival === tehranWallTime(offer.arrivalAt)
          ? offer.arrivalAt
          : wallTimeToUtc(adjustedArrival, 'Asia/Tehran', '+03:30');
      const next = {
        ...draft,
        departureAt,
        arrivalAt,
      };
      if (weekdayOffers)
        await toursApi.reviseOfferBatch(
          loadWeekdayRevisions(offer, weekdayOffers, next),
        );
      else await toursApi.reviseOffer(offer.id, offer.version, next);
      await onSaved();
    } catch (error) {
      setProblem(
        error instanceof Error ? error.message : 'ویرایش بلیط ناموفق بود.',
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      {problem ? <Alert tone="error" title={problem} /> : null}
      {weekdayOffers ? (
        <p>تعداد پروازهای همین روز هفته در این لود: {weekdayOffers.length}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="نوع تأمین">
          <select
            className="h-10 w-full rounded-md border bg-background px-3"
            value={draft.supplyType ?? ''}
            disabled={readOnly || saving}
            onChange={(event) =>
              setDraft((c) => ({
                ...c,
                supplyType: event.target.value as
                  'COMPANY' | 'FLOATING' | 'API',
              }))
            }
          >
            <option value="" disabled>
              نوع تأمین ثبت نشده
            </option>
            <option value="COMPANY">ظرفیت شرکت (چارتر)</option>
            <option value="FLOATING">شناوری</option>
            <option value="API">API</option>
          </select>
        </FormField>
        <TicketBaggageFields
          economy={draft.economyBaggageKg}
          business={draft.businessBaggageKg}
          readOnly={readOnly}
          disabled={saving}
          onChange={(field, value) =>
            setDraft((c) => ({ ...c, [field]: value }))
          }
        />
        {(['returnMinDays', 'returnMaxDays'] as const).map((field) => (
          <FormField
            key={field}
            label={
              field === 'returnMinDays'
                ? 'Min — حداقل روز تا برگشت'
                : 'Max — حداکثر روز تا برگشت'
            }
          >
            <Input
              type="number"
              min={0}
              max={365}
              step={1}
              placeholder="بدون محدودیت"
              value={draft[field] ?? ''}
              readOnly={readOnly}
              disabled={saving}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  [field]:
                    event.target.value === ''
                      ? null
                      : Number(event.target.value),
                }))
              }
            />
          </FormField>
        ))}
        {(['originId', 'destinationId'] as const).map((field) => (
          <FormField key={field} label={field === 'originId' ? 'مبدأ' : 'مقصد'}>
            <Select
              value={draft[field]}
              disabled={readOnly || saving}
              onValueChange={(value) =>
                setDraft((current) => ({ ...current, [field]: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {!cities.some((city) => city.id === draft[field]) ? (
                  <SelectItem value={draft[field]}>شهر ثبت‌شده</SelectItem>
                ) : null}
                {cities.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        ))}
        <ReferencePicker
          id={`published-airline-${offer.id}`}
          label="ایرلاین"
          resource="airlines"
          value={airline}
          readOnly={readOnly || saving}
          onSelect={(reference) => {
            setAirline(reference);
            setDraft((current) => ({
              ...current,
              carrierName: reference?.name ?? '',
            }));
          }}
        />
        <FormField label="شماره پرواز">
          <Input
            required
            maxLength={80}
            value={draft.serviceNumber}
            readOnly={readOnly}
            disabled={saving}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                serviceNumber: event.target.value,
              }))
            }
          />
        </FormField>
        <FormField label="حرکت — ساعت تهران">
          {weekdayOffers ? (
            <Input
              type="time"
              required
              value={departure.slice(11, 16)}
              disabled={saving}
              onChange={(event) =>
                changeDeparture(
                  initialDeparture.slice(0, 10) + 'T' + event.target.value,
                )
              }
            />
          ) : (
            <TicketDatePicker
              includeTime
              value={departure}
              readOnly={readOnly}
              disabled={saving}
              required
              onChange={changeDeparture}
            />
          )}
        </FormField>
        <FormField label="رسیدن — ساعت تهران">
          {weekdayOffers ? (
            <div className="flex gap-2">
              <Input
                type="time"
                required
                value={arrival.slice(11, 16)}
                disabled={saving}
                onChange={(event) =>
                  changeArrival(arrival.slice(0, 10) + 'T' + event.target.value)
                }
              />
              <select
                aria-label="روز رسیدن"
                disabled={saving}
                value={Math.round(
                  (Date.parse(arrival.slice(0, 10)) -
                    Date.parse(departure.slice(0, 10))) /
                    86400000,
                )}
                onChange={(event) =>
                  setArrival(
                    new Date(
                      Date.parse(departure.slice(0, 10)) +
                        Number(event.target.value) * 86400000,
                    )
                      .toISOString()
                      .slice(0, 10) +
                      'T' +
                      arrival.slice(11, 16),
                  )
                }
              >
                <option value="0">همان روز</option>
                <option value="1">روز بعد</option>
                <option value="2">دو روز بعد</option>
              </select>
            </div>
          ) : (
            <TicketDatePicker
              includeTime
              value={arrival}
              readOnly={readOnly}
              disabled={saving}
              required
              onChange={changeArrival}
            />
          )}
        </FormField>
        <FormField label="ظرفیت کل">
          <Input
            type="number"
            min={1}
            step={1}
            required
            value={draft.totalCapacity}
            readOnly={readOnly}
            disabled={saving}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                totalCapacity: Number(event.target.value),
              }))
            }
          />
        </FormField>
        <FormField label="کلاس پرواز">
          <Select
            value={draft.cabinClassCode}
            disabled={readOnly || saving}
            onValueChange={(value) =>
              setDraft((current) => ({
                ...current,
                cabinClassCode: value as typeof draft.cabinClassCode,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ECONOMY">اکونومی</SelectItem>
              <SelectItem value="BUSINESS">بیزینس</SelectItem>
              <SelectItem value="FIRST">فرست</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <ManifestTemplatePicker
        value={draft.manifestTemplateId ?? null}
        readOnly={readOnly || saving}
        onChange={(value) =>
          setDraft((current) => ({ ...current, manifestTemplateId: value }))
        }
      />
      {readOnly ? null : (
        <Button
          type="submit"
          loading={saving}
          disabled={saving || !draft.carrierName.trim()}
        >
          ذخیره تغییرات
        </Button>
      )}
      {weekdayOffers && !readOnly ? (
        <fieldset className="space-y-3 rounded-lg border p-3" disabled={saving}>
          <legend className="px-1 font-semibold">تغییر روز</legend>
          <p className="text-sm text-muted-foreground">
            پروازهای همین روز و مسیر، با اطلاعات ثبت‌شده در همان هفته جابه‌جا
            می‌شوند؛ ساعت‌ها و سایر اطلاعات حفظ می‌شوند.
          </p>
          <FormField label="روز جدید">
            <select
              aria-label="روز جدید"
              className="h-10 w-full rounded-md border bg-background px-3"
              value={targetWeekday}
              onChange={(event) => {
                setTargetWeekday(Number(event.target.value));
                setProblem('');
              }}
            >
              {scheduleWeekdays.map((day) => (
                <option key={day.day} value={day.day}>
                  {day.name}
                </option>
              ))}
            </select>
          </FormField>
          {shiftDays !== 0 ? (
            <p dir="ltr" className="text-center text-sm">
              <time>{initialDeparture.slice(0, 10)}</time>
              {' → '}
              <time>
                {tehranWallTime(
                  new Date(
                    Date.parse(offer.departureAt) + shiftDays * 86400000,
                  ).toISOString(),
                ).slice(0, 10)}
              </time>
            </p>
          ) : null}
          <Button
            type="button"
            loading={saving}
            disabled={saving || !shiftDays}
            onClick={() => void moveWeekday()}
          >
            تغییر روز
          </Button>
        </fieldset>
      ) : null}
    </form>
  );
}
