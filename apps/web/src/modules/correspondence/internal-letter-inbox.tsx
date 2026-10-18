'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Inbox,
  MailOpen,
  CircleCheck,
  FilePenLine,
  Eye,
  Pencil,
  Forward,
  Trash2,
  RotateCw,
  FilterX,
} from 'lucide-react';
import type { InternalLetterList, InternalLetterRecord } from '@nora/contracts';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/overlays';
import { internalLetters } from './api';
import {
  internalStatusLabels,
  LetterIconAction,
  LetterRecipientDialog,
} from './internal-controls';
import { OutgoingLetterWorkspace } from './outgoing-letter-workspace';

const emptyFilters = { search: '', status: '', company: '', unread: false };
export function InternalLetterInbox() {
  const [filters, setFilters] = useState(emptyFilters),
    [applied, setApplied] = useState(emptyFilters);
  const [page, setPage] = useState(1),
    [revision, setRevision] = useState(0);
  const [data, setData] = useState<InternalLetterList | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [selected, setSelected] = useState<{
    record: InternalLetterRecord;
    mode: 'view' | 'edit';
  } | null>(null);
  const [forward, setForward] = useState<InternalLetterRecord | null>(null),
    [deleting, setDeleting] = useState<InternalLetterRecord | null>(null);
  const [actionBusy, setActionBusy] = useState(false),
    [forwardKey, setForwardKey] = useState('');
  const refresh = () => {
    setLoading(true);
    setError('');
    setRevision((value) => value + 1);
  };
  const changePage = (value: number) => {
    setLoading(true);
    setError('');
    setPage(value);
  };
  useEffect(() => {
    let live = true;
    const query = new URLSearchParams({ page: String(page) });
    for (const [key, value] of Object.entries(applied))
      if (value) query.set(key, String(value));
    void internalLetters
      .list(query)
      .then((result) => {
        if (live) {
          setData(result);
        }
      })
      .catch((cause) => {
        if (live)
          setError(
            cause instanceof Error ? cause.message : 'نامه‌ها بارگذاری نشدند.',
          );
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [applied, page, revision]);
  const open = async (record: InternalLetterRecord, mode: 'view' | 'edit') => {
    setActionBusy(true);
    setError('');
    try {
      const fresh = await internalLetters.detail(record.id);
      await internalLetters.read(record.id);
      setSelected({ record: fresh, mode });
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'نامه بارگذاری نشد.');
    } finally {
      setActionBusy(false);
    }
  };
  const field =
    'w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-sm';
  return (
    <section dir="rtl" className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-primary/10 p-3 text-primary">
            <Inbox />
          </span>
          <h1 className="text-2xl font-bold">نامه‌های دریافتی داخلی</h1>
        </div>
        <Link
          href="/correspondence/internal"
          className="text-sm text-primary underline"
        >
          بازگشت به مکاتبات داخلی
        </Link>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'کل نامه‌های دریافتی',
            value: data?.kpis.total,
            Icon: Inbox,
          },
          { label: 'خوانده‌نشده', value: data?.kpis.unread, Icon: MailOpen },
          { label: 'تأیید', value: data?.kpis.approved, Icon: CircleCheck },
          {
            label: 'نیازمند اصلاح',
            value: data?.kpis.needsCorrection,
            Icon: FilePenLine,
          },
        ].map(({ label, value, Icon }) => (
          <article
            key={label}
            className="flex items-center justify-between rounded-2xl border bg-surface p-5 shadow-sm"
          >
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-3 text-2xl font-bold tabular-nums">
                {value === undefined
                  ? '—'
                  : new Intl.NumberFormat('fa-IR').format(value)}
              </p>
            </div>
            <span className="rounded-xl bg-primary/10 p-3 text-primary">
              <Icon className="size-6" />
            </span>
          </article>
        ))}
      </div>
      <form
        className="grid gap-4 rounded-2xl border bg-surface p-5 shadow-sm md:grid-cols-2 xl:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          setLoading(true);
          setError('');
          setApplied({ ...filters });
          setPage(1);
        }}
      >
        <label className="space-y-2 text-sm">
          <span>شماره یا موضوع نامه</span>
          <input
            className={field}
            value={filters.search}
            maxLength={160}
            onChange={(event) =>
              setFilters({ ...filters, search: event.target.value })
            }
          />
        </label>
        <label className="space-y-2 text-sm">
          <span>وضعیت</span>
          <select
            className={field}
            value={filters.status}
            onChange={(event) =>
              setFilters({ ...filters, status: event.target.value })
            }
          >
            <option value="">همه وضعیت‌ها</option>
            {Object.entries(internalStatusLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span>شرکت</span>
          <select
            className={field}
            value={filters.company}
            onChange={(event) =>
              setFilters({ ...filters, company: event.target.value })
            }
          >
            <option value="">همه شرکت‌ها</option>
            {['نیایش سیر', 'جهان باستان', 'قسطی روو'].map((company) => (
              <option key={company}>{company}</option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <label className="mb-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.unread}
              onChange={(event) =>
                setFilters({ ...filters, unread: event.target.checked })
              }
            />
            فقط خوانده‌نشده
          </label>
          <Button type="submit" disabled={loading}>
            اعمال فیلتر
          </Button>
          <LetterIconAction
            label="حذف فیلترها"
            onClick={() => {
              setFilters(emptyFilters);
              setLoading(true);
              setError('');
              setApplied({ ...emptyFilters });
              setPage(1);
            }}
          >
            <FilterX className="size-4" />
          </LetterIconAction>
        </div>
      </form>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div className="overflow-hidden rounded-2xl border bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="font-semibold">فهرست نامه‌ها</h2>
          <LetterIconAction
            label="بارگذاری مجدد"
            disabled={loading}
            onClick={refresh}
          >
            <RotateCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </LetterIconAction>
        </div>
        <div className="overflow-x-auto" aria-busy={loading}>
          <table className="w-full min-w-[950px] text-right text-sm">
            <thead className="bg-primary/5 text-muted-foreground">
              <tr>
                {[
                  'شماره نامه',
                  'موضوع',
                  'فرستنده',
                  'شرکت',
                  'تاریخ دریافت',
                  'وضعیت',
                  'خوانده‌شدن',
                  'عملیات',
                ].map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="whitespace-nowrap px-4 py-3 font-medium"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading &&
                data?.items.map((record) => (
                  <tr
                    key={record.id}
                    className={`border-t transition hover:bg-primary/5 ${record.delivery.readAt ? '' : 'bg-primary/[0.025] font-medium'}`}
                  >
                    <td className="px-4 py-3" dir="ltr">
                      {record.letter.number}
                    </td>
                    <td className="max-w-64 px-4 py-3">
                      <span className="line-clamp-2">
                        {record.letter.subject}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {record.delivery.sender.displayName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {record.letter.company}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {new Intl.DateTimeFormat('fa-IR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                        timeZone: 'Asia/Tehran',
                      }).format(new Date(record.delivery.createdAt))}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${record.delivery.status === 'REJECTED' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}
                      >
                        {internalStatusLabels[record.delivery.status]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {record.delivery.readAt ? 'خوانده‌شده' : 'خوانده‌نشده'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <LetterIconAction
                          label="مشاهده"
                          disabled={actionBusy}
                          onClick={() => void open(record, 'view')}
                        >
                          <Eye className="size-4" />
                        </LetterIconAction>
                        <LetterIconAction
                          label="ویرایش"
                          disabled={actionBusy}
                          onClick={() => void open(record, 'edit')}
                        >
                          <Pencil className="size-4" />
                        </LetterIconAction>
                        <LetterIconAction
                          label="بازارسال"
                          disabled={actionBusy}
                          onClick={() => {
                            setForward(record);
                            setForwardKey(crypto.randomUUID());
                          }}
                        >
                          <Forward className="size-4" />
                        </LetterIconAction>
                        <LetterIconAction
                          label="حذف"
                          disabled={actionBusy}
                          onClick={() => setDeleting(record)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </LetterIconAction>
                      </div>
                    </td>
                  </tr>
                ))}
              {(loading || !data?.items.length) && (
                <tr>
                  <td
                    colSpan={8}
                    className="p-12 text-center text-muted-foreground"
                  >
                    {loading
                      ? 'در حال بارگذاری نامه‌ها…'
                      : error
                        ? 'بارگذاری نامه‌ها ناموفق بود.'
                        : 'نامه‌ای برای نمایش وجود ندارد.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="flex items-center justify-between gap-3 border-t p-4 text-sm text-muted-foreground">
          <span>تعداد رکوردها: {data?.total ?? '—'}</span>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() => changePage(page - 1)}
            >
              قبلی
            </Button>
            <span>صفحه {page}</span>
            <Button
              variant="outline"
              disabled={loading || !data || page * data.pageSize >= data.total}
              onClick={() => changePage(page + 1)}
            >
              بعدی
            </Button>
          </div>
        </footer>
      </div>
      <LetterRecipientDialog
        open={!!forward}
        onOpenChange={(value) => {
          if (!value) setForward(null);
        }}
        forward
        onSubmit={async (recipient, status) => {
          if (!forward) return;
          await internalLetters.forward(
            forward.id,
            forward.version,
            recipient,
            status,
            forwardKey,
          );
          refresh();
        }}
      />
      <Dialog
        open={!!selected}
        onOpenChange={(value) => {
          if (!value) {
            setSelected(null);
            refresh();
          }
        }}
      >
        <DialogContent
          dir="rtl"
          className="max-h-[94vh] max-w-[94vw] overflow-y-auto"
        >
          <DialogTitle>
            {selected?.mode === 'edit'
              ? 'ویرایش نامه داخلی'
              : 'مشاهده نامه داخلی'}
          </DialogTitle>
          <DialogDescription>نامه و سربرگ</DialogDescription>
          {selected && (
            <div className="mt-6">
              <OutgoingLetterWorkspace
                key={selected.record.id}
                internal
                initialRecord={selected.record}
                readOnly={selected.mode === 'view'}
                onSaved={refresh}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleting}
        onOpenChange={(value) => {
          if (!value && !actionBusy) setDeleting(null);
        }}
      >
        <DialogContent dir="rtl">
          <DialogTitle>حذف نامه داخلی</DialogTitle>
          <DialogDescription>
            نامه و تمام ارسال‌های آن برای همه گیرندگان به‌طور کامل حذف می‌شود.
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="outline"
              disabled={actionBusy}
              onClick={() => setDeleting(null)}
            >
              انصراف
            </Button>
            <Button
              variant="destructive"
              disabled={actionBusy}
              onClick={() => {
                if (!deleting) return;
                setActionBusy(true);
                setError('');
                void internalLetters
                  .remove(deleting.id, deleting.version)
                  .then(() => {
                    setDeleting(null);
                    refresh();
                  })
                  .catch((cause) => {
                    setDeleting(null);
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : 'حذف نامه ناموفق بود.',
                    );
                  })
                  .finally(() => setActionBusy(false));
              }}
            >
              حذف کامل
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
