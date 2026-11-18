'use client';

import { useEffect, useState } from 'react';
import type { MasterDataRecord } from '@nora/contracts';
import { masterDataApi } from '../../master-data/api/client';
import Link from '@/i18n/link';
import { localizedFetch } from '@/i18n/localized-fetch';
import { getPublicApiBaseUrl } from '@/lib/environment';

export function HotelPublication({ id, manage = false }: { id: string; manage?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [url, setUrl] = useState('');
  async function publish() {
    setBusy(true);
    setMessage('');
    setUrl('');
    try {
      const response = await localizedFetch(getPublicApiBaseUrl() + '/sales/site-commerce/v1/jahan-bastan/hotel-profiles/' + encodeURIComponent(id), {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json', 'x-nora-site-commerce': '1' }, body: '{}',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || result.message || 'ثبت هتل انجام نشد.');
      setUrl(result.url);
      setMessage('اطلاعات هتل ثبت شد.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ارتباط با سایت برقرار نشد.');
    } finally {
      setBusy(false);
    }
  }
  return <div className="grid gap-2 rounded-lg border bg-background p-3 text-start text-sm">
    <div className="flex items-center justify-between gap-3"><strong>جهان باستان</strong>
      <button type="button" onClick={publish} disabled={busy} aria-label="ثبت هتل در جهان باستان">{busy ? 'در حال ثبت…' : '✓ ثبت'}</button></div>
    {message && <span role="status">{message}</span>}
    {url && <a className="underline" href={url}>مشاهده صفحه هتل</a>}
    {!manage && <Link href={'/integrations?view=hotels&hotelId=' + encodeURIComponent(id)}>مدیریت انتشار در سایت</Link>}
  </div>;
}

export function HotelPublicationManager({ selected }: { selected?: string | null }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<MasterDataRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const result = await masterDataApi.list('hotels', { search, page, pageSize: 20 });
        if (active) { setRecords(result.data); setTotal(result.meta.total); setStatus(''); }
      } catch { if (active) setStatus('دریافت فهرست هتل‌ها انجام نشد.'); }
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [search, page]);
  return <section className="grid gap-3">
    {selected && <HotelPublication key={selected} id={selected} manage />}
    <input aria-label="جست‌وجوی هتل" placeholder="جست‌وجوی هتل" className="rounded-lg border p-2" value={search} onChange={event => { setPage(1); setSearch(event.target.value); }} />
    {status && <p role="status">{status}</p>}
    {records.map(hotel => <details key={hotel.id} className="rounded-lg border p-3">
      <summary>{hotel.name} · {hotel.attributes.identificationCode || 'فاقد کد شناسایی'}</summary>
      <HotelPublication id={hotel.id} manage />
    </details>)}
    <div className="flex gap-4"><button disabled={page === 1} onClick={() => setPage(page - 1)}>قبلی</button><button disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>بعدی</button></div>
  </section>;
}
