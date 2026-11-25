'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Globe2,
  LoaderCircle,
  Settings2,
  X,
} from 'lucide-react';
import type { MasterDataRecord } from '@nora/contracts';
import { masterDataApi } from '../../master-data/api/client';
import styles from './site-management.module.css';
import Link from '@/i18n/link';
import { localizedFetch } from '@/i18n/localized-fetch';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { useUiTranslation } from '@/i18n/locale-context';
import type {
  CommerceWebsiteCode,
  ProfilePublicationResource,
} from '../site-publication-model';

const siteLabels = {
  'jahan-bastan': {
    name: 'جهان باستان',
    publish: 'ثبت در جهان باستان',
    view: 'مشاهده در جهان باستان',
    error: 'ثبت در جهان باستان انجام نشد.',
  },
  ghestiroo: {
    name: 'قسطی‌رو',
    publish: 'ثبت در قسطی‌رو',
    view: 'مشاهده در قسطی‌رو',
    error: 'ثبت در قسطی‌رو انجام نشد.',
  },
  nss: {
    name: 'نیایش سیر',
    publish: 'ثبت در نیایش سیر',
    view: 'مشاهده در نیایش سیر',
    error: 'ثبت در نیایش سیر انجام نشد.',
  },
} as const;
type ProfileSite = CommerceWebsiteCode;
const profileSites = ['jahan-bastan', 'ghestiroo', 'nss'] as const;

export function HotelPublicationAction({
  id,
  name,
  resource = 'hotels',
}: {
  id: string;
  name: string;
  resource?: ProfilePublicationResource;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const label = `انتشار ${name} در سایت`;

  return (
    <>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        title={label}
        onClick={() => dialog.current?.showModal()}
        className="inline-flex size-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-primary transition hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Globe2 aria-hidden="true" className="size-[18px]" />
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100%-2rem)] max-w-md overflow-auto rounded-2xl border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-slate-950/45"
      >
        <header className="flex items-center justify-between gap-3 border-b border-border bg-primary/5 px-5 py-4 text-start">
          <div className="min-w-0">
            <h2 id={titleId} className="font-bold text-primary">
              مدیریت انتشار در سایت
            </h2>
            <p
              dir="auto"
              className="mt-1 break-words text-sm text-muted-foreground"
            >
              {name}
            </p>
          </div>
          <button
            type="button"
            aria-label="بستن"
            onClick={() => dialog.current?.close()}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background hover:bg-muted"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </header>
        <div className="p-5">
          <HotelPublication id={id} resource={resource} />
        </div>
      </dialog>
    </>
  );
}

export function HotelPublication({
  id,
  manage = false,
  resource = 'hotels',
  site,
}: {
  id: string;
  manage?: boolean;
  resource?: ProfilePublicationResource;
  site?: ProfileSite | undefined;
}) {
  return (
    <div className="grid gap-3 text-start text-sm">
      {(site ? [site] : profileSites).map((destination) => (
        <ProfileDestination
          key={destination}
          id={id}
          resource={resource}
          site={destination}
        />
      ))}
      {!manage && resource === 'hotels' && (
        <Link
          className="flex items-center gap-2 border-t border-border pt-3 font-medium text-primary hover:underline"
          href={'/integrations?view=hotels&hotelId=' + encodeURIComponent(id)}
        >
          <Settings2 aria-hidden="true" className="size-4" /> مدیریت انتشار در
          سایت
        </Link>
      )}
    </div>
  );
}

function ProfileDestination({
  id,
  resource,
  site,
}: {
  id: string;
  resource: ProfilePublicationResource;
  site: ProfileSite;
}) {
  const labels = siteLabels[site];
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [url, setUrl] = useState('');
  async function publish() {
    setBusy(true);
    setMessage('');
    setUrl('');
    try {
      const response = await localizedFetch(
        getPublicApiBaseUrl() +
          '/sales/site-commerce/v1/' +
          site +
          '/' +
          (resource === 'hotels'
            ? 'hotel-profiles/'
            : resource === 'visa-services'
              ? 'visa-profiles/'
              : 'geography-profiles/' + resource + '/') +
          encodeURIComponent(id),
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'content-type': 'application/json',
            'x-nora-site-commerce': '1',
          },
          body: '{}',
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message || result.message || labels.error,
        );
      setUrl(result.url);
      setMessage('اطلاعات ثبت شد.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'ارتباط با سایت برقرار نشد.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-3 rounded-xl border border-border bg-background p-3 text-start text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Globe2 aria-hidden="true" className="size-[18px]" />
          </span>
          <strong>{labels.name}</strong>
        </div>
        <button
          type="button"
          onClick={publish}
          disabled={busy}
          aria-label={labels.publish}
          className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-primary px-3 font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Check aria-hidden="true" className="size-4" />
          )}
          {busy ? 'در حال ثبت…' : 'ثبت'}
        </button>
      </div>
      {message && (
        <span
          role="status"
          className={`rounded-lg px-3 py-2 ${url ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'}`}
        >
          {message}
        </span>
      )}
      {url && (
        <a
          className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
          href={url}
        >
          {labels.view}
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </a>
      )}
    </div>
  );
}

const searchLabels: Record<ProfilePublicationResource, string> = {
  hotels: 'جست‌وجوی هتل',
  countries: 'جست‌وجوی کشور',
  cities: 'جست‌وجوی شهر',
  'visa-services': 'جست‌وجوی خدمت ویزا',
};

export function ProfilePublicationManager({
  resource,
  selected,
  site,
}: {
  resource: ProfilePublicationResource;
  selected?: string | null | undefined;
  site?: ProfileSite | undefined;
}) {
  const t = useUiTranslation();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<readonly MasterDataRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setStatus('');
    const timer = setTimeout(async () => {
      try {
        const result = await masterDataApi.list(resource, {
          search,
          page,
          pageSize: 20,
          status: 'all',
          sortBy: 'name',
          sortDirection: 'asc',
        });
        if (active) {
          setRecords(result.data);
          setTotal(result.meta.total);
          setStatus('');
        }
      } catch {
        if (active) setStatus('دریافت فهرست انجام نشد.');
      } finally {
        if (active) setLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [resource, search, page]);
  return (
    <section className="grid gap-3">
      {selected && (
        <HotelPublication
          key={selected}
          id={selected}
          resource={resource}
          site={site}
          manage
        />
      )}
      <label className={styles.profileSearch}>
        {t(searchLabels[resource])}
        <input
          aria-label={t(searchLabels[resource])}
          placeholder={t(searchLabels[resource])}
          className="rounded-lg border border-border bg-surface p-2"
          value={search}
          onChange={(event) => {
            setPage(1);
            setSearch(event.target.value);
          }}
        />
      </label>
      {loading && <p role="status">{t('در حال بارگذاری…')}</p>}
      {!loading && !status && records.length === 0 && (
        <p role="status">{t('موردی یافت نشد.')}</p>
      )}
      {status && <p role="status">{t(status)}</p>}
      {!loading &&
        !status &&
        records.map((record) => (
          <details key={record.id} className={styles.record}>
            <summary>
              <span dir="auto">{record.name}</span>
              {resource === 'hotels' && (
                <small>
                  <bdi>
                    {String(
                      record.attributes.identificationCode ||
                        t('فاقد کد شناسایی'),
                    )}
                  </bdi>
                </small>
              )}
            </summary>
            <div className="mt-3">
              <HotelPublication
                id={record.id}
                resource={resource}
                site={site}
                manage
              />
            </div>
          </details>
        ))}
      {!loading && !status && total > 20 && (
        <div className={styles.pagination}>
          <button disabled={page === 1} onClick={() => setPage(page - 1)}>
            قبلی
          </button>
          <span>
            {page.toLocaleString('fa-IR')} /{' '}
            {Math.ceil(total / 20).toLocaleString('fa-IR')}
          </span>
          <button
            disabled={page * 20 >= total}
            onClick={() => setPage(page + 1)}
          >
            بعدی
          </button>
        </div>
      )}
    </section>
  );
}
