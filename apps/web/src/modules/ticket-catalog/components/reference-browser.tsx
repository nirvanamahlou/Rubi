'use client';

import { useEffect, useState } from 'react';
import type { MasterDataRecord } from '@rubi/contracts';
import { Alert, Badge, Button, Card, Input } from '@/components/ui';
import {
  listReferences,
  ReferenceApiError,
  type PublishedResource,
} from '../api/references';

const resourceLabels: Record<PublishedResource, string> = {
  airlines: 'ایرلاین',
  currencies: 'ارز',
  countries: 'کشور',
  cities: 'شهر',
};
export function ReferenceBrowser({
  onSelect,
}: {
  onSelect: (record: MasterDataRecord) => void;
}) {
  const [resource, setResource] = useState<PublishedResource>('airlines');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<{
    state: string;
    rows: readonly MasterDataRecord[];
    total: number;
  }>({ state: 'loading', rows: [], total: 0 });
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(() => {
      setResult({ state: 'loading', rows: [], total: 0 });
      void listReferences(resource, search, page, abort.signal)
        .then((data) => {
          if (!abort.signal.aborted)
            setResult({
              state: 'ready',
              rows: data.data,
              total: data.meta.total,
            });
        })
        .catch((error: unknown) => {
          if (!abort.signal.aborted)
            setResult({
              state: error instanceof ReferenceApiError ? error.state : 'error',
              rows: [],
              total: 0,
            });
        });
    }, 250);
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [resource, search, page, reload]);
  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">مراجع اطلاعات پایه</h2>
        <Badge>فقط خواندن از API موجود</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        ایرلاین و ارز را برای فرم پیش‌نویس انتخاب کنید. کشور و شهر فقط قابل
        مشاهده‌اند؛ جایگزین فرودگاه نیستند.
      </p>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="نوع مرجع"
          className="rounded-xl border bg-surface p-2"
          value={resource}
          onChange={(event) => {
            setResource(event.target.value as PublishedResource);
            setPage(1);
            setResult({ state: 'loading', rows: [], total: 0 });
          }}
        >
          {Object.entries(resourceLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <Input
          className="max-w-xs"
          aria-label="جست‌وجوی مرجع"
          placeholder="جست‌وجو در اطلاعات پایه…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
            setResult({ state: 'loading', rows: [], total: 0 });
          }}
        />
        <Button
          variant="outline"
          onClick={() => {
            setResult({ state: 'loading', rows: [], total: 0 });
            setReload((v) => v + 1);
          }}
        >
          دریافت دوباره
        </Button>
      </div>
      {result.state === 'loading' ? (
        <p role="status">در حال دریافت مراجع…</p>
      ) : result.state !== 'ready' ? (
        <Alert
          tone="warning"
          title={
            (
              {
                unavailable: 'اتصال API پیکربندی نشده است',
                unauthorized: 'ورود لازم است (401)',
                forbidden: 'مجوز خواندن اطلاعات پایه ندارید (403)',
                conflict: 'تعارض نسخه مرجع (409)',
                error: 'دریافت اطلاعات پایه ناموفق بود',
              } as Record<string, string>
            )[result.state] ?? 'مرجع در دسترس نیست'
          }
          description="هیچ داده یا شناسه جایگزین تولید نشده است. Preview مستقل بلیت قابل بررسی است."
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {result.rows.length ? (
              result.rows.map((record) => (
                <Button
                  key={record.id}
                  variant="outline"
                  disabled={resource === 'countries' || resource === 'cities'}
                  onClick={() => onSelect(record)}
                >
                  {record.name}{' '}
                  <span dir="ltr" className="text-xs text-muted-foreground">
                    {record.code}
                  </span>
                </Button>
              ))
            ) : (
              <p role="status">مرجع فعال مطابق جست‌وجو وجود ندارد.</p>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Button
              variant="ghost"
              disabled={page === 1}
              onClick={() => {
                setPage(page - 1);
                setResult({ state: 'loading', rows: [], total: 0 });
              }}
            >
              قبلی
            </Button>
            <span>
              صفحه {page.toLocaleString('fa-IR')} از{' '}
              {Math.max(1, Math.ceil(result.total / 25)).toLocaleString(
                'fa-IR',
              )}
            </span>
            <Button
              variant="ghost"
              disabled={page * 25 >= result.total}
              onClick={() => {
                setPage(page + 1);
                setResult({ state: 'loading', rows: [], total: 0 });
              }}
            >
              بعدی
            </Button>
          </div>
        </>
      )}
      <p className="text-xs leading-6 text-muted-foreground">
        فرودگاه، هواپیما، کلاس پروازی و بار: منتظر قرارداد منتشرشده PC-B. نرخ
        ارز مالی و تبدیل ارز در این بخش ارائه نمی‌شود.
      </p>
    </Card>
  );
}
