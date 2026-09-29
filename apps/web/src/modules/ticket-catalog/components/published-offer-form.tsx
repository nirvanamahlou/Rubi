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
import { publishedOfferInput } from '../model/published-catalog';
import { TicketDatePicker } from './ticket-date-picker';
import { ManifestTemplatePicker } from './manifest-template-picker';
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
}: {
  offer: TicketOfferV1;
  readOnly: boolean;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(publishedOfferInput(offer));
  const [departure, setDeparture] = useState(tehranWallTime(offer.departureAt));
  const [arrival, setArrival] = useState(tehranWallTime(offer.arrivalAt));
  const [cities, setCities] = useState<Reference[]>([]);
  const [problem, setProblem] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
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
    if (readOnly || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setProblem('');
    try {
      const departureAt =
        departure === tehranWallTime(offer.departureAt)
          ? offer.departureAt
          : wallTimeToUtc(departure, 'Asia/Tehran', '+03:30');
      const arrivalAt =
        arrival === tehranWallTime(offer.arrivalAt)
          ? offer.arrivalAt
          : wallTimeToUtc(arrival, 'Asia/Tehran', '+03:30');
      await toursApi.reviseOffer(offer.id, offer.version, {
        ...draft,
        departureAt,
        arrivalAt,
      });
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
      <div className="grid gap-3 sm:grid-cols-2">
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
        <FormField label="ایرلاین">
          <Input
            required
            maxLength={160}
            value={draft.carrierName}
            readOnly={readOnly}
            disabled={saving}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                carrierName: event.target.value,
              }))
            }
          />
        </FormField>
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
          <TicketDatePicker
            includeTime
            value={departure}
            readOnly={readOnly}
            disabled={saving}
            required
            onChange={setDeparture}
          />
        </FormField>
        <FormField label="رسیدن — ساعت تهران">
          <TicketDatePicker
            includeTime
            value={arrival}
            readOnly={readOnly}
            disabled={saving}
            required
            onChange={setArrival}
          />
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
        <Button type="submit" loading={saving} disabled={saving}>
          ذخیره تغییرات
        </Button>
      )}
    </form>
  );
}
