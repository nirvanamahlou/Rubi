'use client';
import { useState } from 'react';
import type {
  DocumentListItemV1,
  ProcurementDocumentReferenceV1,
} from '@rubi/contracts';
import { documentsApi } from '@/modules/documents/api/client';
import { Input } from '@/components/ui/form-controls';
import { Alert } from '@/components/ui/surfaces';
import { Button } from '@/components/ui/button';

export function ProcurementDocumentPicker({
  branchId,
  value,
  onChange,
  available,
}: {
  branchId: string;
  value: ProcurementDocumentReferenceV1[];
  onChange: (value: ProcurementDocumentReferenceV1[]) => void;
  available: boolean;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<readonly DocumentListItemV1[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function load(targetPage: number) {
    setBusy(true);
    setError('');
    try {
      const result = await documentsApi.list({
        page: targetPage,
        pageSize: 20,
        domain: 'PROCUREMENT',
        branchId,
        scanStatus: 'CLEAN',
        search,
      });
      setRows(result.data);
      setHasMore(result.meta.page < result.meta.totalPages);
      setPage(targetPage);
      setLoaded(true);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'اسناد دریافت نشدند.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">مدارک این عملیات</h3>
      {available ? (
        <>
          <p className="text-xs text-muted-foreground">
            نسخه سالم اسناد خرید مربوط به همین شعبه را انتخاب کنید. اصل فایل در
            آرشیو اسناد باقی می‌ماند.
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              className="min-w-40 flex-1"
              aria-label="جست‌وجوی مدارک عملیات"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              loading={busy}
              onClick={() => void load(1)}
            >
              جست‌وجوی مدرک
            </Button>
          </div>
          {error && (
            <Alert
              tone="error"
              title="دریافت اسناد ناموفق بود"
              description={error}
            />
          )}
          {loaded && !rows.length && (
            <p className="text-sm text-muted-foreground">
              سندی با این شرایط پیدا نشد.
            </p>
          )}
          {rows.map((row) => (
            <label
              key={row.id}
              className="flex min-h-11 items-center gap-3 text-sm"
            >
              <input
                type="checkbox"
                checked={value.some((ref) => ref.id === row.id)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [
                          ...value.filter((ref) => ref.id !== row.id),
                          { id: row.id, versionId: row.currentVersion.id },
                        ]
                      : value.filter((ref) => ref.id !== row.id),
                  )
                }
              />
              {row.title} · {row.archiveCode}
            </label>
          ))}
          {loaded && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={busy || page <= 1}
                onClick={() => void load(page - 1)}
              >
                صفحه قبل اسناد
              </Button>
              <span className="text-xs">{page.toLocaleString('fa-IR')}</span>
              <Button
                type="button"
                variant="ghost"
                disabled={busy || !hasMore}
                onClick={() => void load(page + 1)}
              >
                صفحه بعد اسناد
              </Button>
            </div>
          )}
        </>
      ) : (
        <Alert
          title="اسناد در دسترس نیست"
          description="مدارک جدید پس از دسترس‌پذیر شدن سرویس اسناد قابل انتخاب هستند."
        />
      )}
      <p className="text-sm">
        مدارک انتخاب‌شده: {value.length.toLocaleString('fa-IR')}
      </p>
      {value.map((ref) => (
        <div key={ref.id} className="flex flex-wrap items-center gap-2 text-xs">
          <span className="break-all">
            {rows.find((row) => row.id === ref.id)?.title ?? ref.id}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(value.filter((item) => item.id !== ref.id))}
          >
            حذف از این عملیات
          </Button>
        </div>
      ))}
    </div>
  );
}
