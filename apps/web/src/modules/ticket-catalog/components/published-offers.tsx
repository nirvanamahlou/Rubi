'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { MasterDataRecord, TicketOfferCreateV1 } from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { FormField, Input } from '@/components/ui/form-controls';
import { Alert, Card } from '@/components/ui/surfaces';
import { masterDataApi } from '@/modules/master-data/api/client';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';

export function PublishedOffers() {
  const [open, setOpen] = useState(false);
  const [cities, setCities] = useState<readonly MasterDataRecord[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const attempt = useRef({ fingerprint: '', key: '' });
  const [input, setInput] = useState<TicketOfferCreateV1>({
    originId: '',
    destinationId: '',
    departureAt: '',
    arrivalAt: '',
    carrierName: '',
    serviceNumber: '',
    cabinClassCode: 'ECONOMY',
    totalCapacity: 1,
  });
  useEffect(() => {
    if (!open) return;
    void masterDataApi
      .list('cities', {
        search: '',
        status: 'active',
        sortBy: 'name',
        sortDirection: 'asc',
        page: 1,
        pageSize: 100,
      })
      .then((result) => setCities(result.data))
      .catch(() => setMessage('دریافت شهرها ناموفق بود.'));
  }, [open]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const base = getPublicApiBaseUrl();
      if (!base) throw new Error('سرور پیکربندی نشده است.');
      const session = await refreshAuthenticatedSession(base);
      const branchId = session?.user.branches[0]?.id;
      if (!branchId) throw new Error('شعبه مجاز یافت نشد.');
      const fingerprint = JSON.stringify({ input, branchId });
      if (attempt.current.fingerprint !== fingerprint)
        attempt.current = { fingerprint, key: crypto.randomUUID() };
      const response = await fetch(`${base}/ticket-catalog/offers`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          'x-branch-id': branchId,
          'idempotency-key': attempt.current.key,
        },
        body: JSON.stringify({
          ...input,
          departureAt: new Date(input.departureAt).toISOString(),
          arrivalAt: new Date(input.arrivalAt).toISOString(),
        }),
      });
      if (!response.ok)
        throw new Error(
          'ثبت بلیت ناموفق بود؛ مجوز مدیریت بلیت، مسیر و زمان‌ها را بررسی کنید.',
        );
      setMessage('بلیت ذخیره شد و در جست‌وجوی فروش قابل انتخاب است.');
      setOpen(false);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'ثبت ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="mb-5 p-5">
      <Button onClick={() => setOpen(!open)}>
        ثبت بلیت زمان‌دار برای فروش
      </Button>
      {message ? <Alert className="mt-3" title={message} /> : null}
      {open ? (
        <form
          onSubmit={(event) => void submit(event)}
          className="mt-5 grid gap-4 md:grid-cols-2"
        >
          {(['originId', 'destinationId'] as const).map((key) => (
            <FormField
              key={key}
              label={key === 'originId' ? 'مبدأ' : 'مقصد'}
              required
            >
              <select
                className="h-11 rounded-xl border bg-surface px-3"
                required
                value={input[key]}
                onChange={(event) =>
                  setInput({ ...input, [key]: event.target.value })
                }
              >
                <option value="">انتخاب شهر</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </FormField>
          ))}
          <FormField label="حرکت" required>
            <DatePicker
              includeTime
              value={input.departureAt}
              onChange={(departureAt) => setInput({ ...input, departureAt })}
            />
          </FormField>
          <FormField label="رسیدن" required>
            <DatePicker
              includeTime
              value={input.arrivalAt}
              onChange={(arrivalAt) => setInput({ ...input, arrivalAt })}
            />
          </FormField>
          <FormField label="ایرلاین" required>
            <Input
              required
              value={input.carrierName}
              onChange={(event) =>
                setInput({ ...input, carrierName: event.target.value })
              }
            />
          </FormField>
          <FormField label="شماره پرواز" required>
            <Input
              required
              value={input.serviceNumber}
              onChange={(event) =>
                setInput({ ...input, serviceNumber: event.target.value })
              }
            />
          </FormField>
          <FormField label="کلاس">
            <select
              className="h-11 rounded-xl border bg-surface px-3"
              value={input.cabinClassCode}
              onChange={(event) =>
                setInput({
                  ...input,
                  cabinClassCode: event.target
                    .value as TicketOfferCreateV1['cabinClassCode'],
                })
              }
            >
              <option value="ECONOMY">اکونومی</option>
              <option value="BUSINESS">بیزینس</option>
              <option value="FIRST">فرست</option>
            </select>
          </FormField>
          <FormField label="ظرفیت کل" required>
            <Input
              required
              type="number"
              min={1}
              value={input.totalCapacity}
              onChange={(event) =>
                setInput({
                  ...input,
                  totalCapacity: Number(event.target.value),
                })
              }
            />
          </FormField>
          <Button type="submit" loading={busy}>
            ذخیره بلیت قابل فروش
          </Button>
        </form>
      ) : null}
    </Card>
  );
}
