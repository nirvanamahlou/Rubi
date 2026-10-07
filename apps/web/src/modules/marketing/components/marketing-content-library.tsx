'use client';

import type { DocumentListItemV1 } from '@nora/contracts';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form-controls';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { Card } from '@/components/ui/surfaces';
import { documentsApi } from '@/modules/documents/api/client';

/** The library is a view of public Documents records, not a second file store. */
export function MarketingContentLibrary({
  revision,
  adding,
  onAdd,
  onNotice,
}: {
  revision: number;
  adding: boolean;
  onAdd: () => void;
  onNotice: (message: string) => void;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [items, setItems] = useState<readonly DocumentListItemV1[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [editor, setEditor] = useState<{
    item: DocumentListItemV1;
    mode: 'edit' | 'delete';
  } | null>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [mutationError, setMutationError] = useState('');
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError('');
      void documentsApi
        .list({
          domain: 'BRAND',
          archiveStatus: 'ACTIVE',
          search,
          page,
          pageSize: 25,
          sortBy: 'updatedAt',
          sortDirection: 'desc',
        })
        .then((response) => {
          if (active) {
            setItems(response.data);
            setPages(response.meta.totalPages || 1);
          }
        })
        .catch((reason: unknown) => {
          if (active)
            setError(
              reason instanceof Error
                ? reason.message
                : 'دریافت محتوا انجام نشد.',
            );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, page, revision, reload]);
  const canonical = (item: DocumentListItemV1) =>
    router.push(`/documents?document=${encodeURIComponent(item.id)}`);
  const begin = (item: DocumentListItemV1, mode: 'edit' | 'delete') => {
    if (
      item.requiresStepUpVerification ||
      item.requiresConfidentialAccessCode
    ) {
      canonical(item);
      onNotice('برای این سند، تأیید دسترسی در بخش اسناد و فایل‌ها لازم است.');
      return;
    }
    setEditor({ item, mode });
    setValue(mode === 'edit' ? item.title : '');
    setMutationError('');
  };
  const submit = async () => {
    if (!editor || busy) return;
    setBusy(true);
    setMutationError('');
    try {
      const { item, mode } = editor;
      if (mode === 'delete') {
        await documentsApi.archive(item.id, {
          reason: value.trim(),
          version: item.version,
        });
      } else {
        const { data } = await documentsApi.detail(item.id);
        if (data.version !== item.version)
          throw new Error(
            'این سند تغییر کرده است؛ فهرست را تازه‌سازی و دوباره ویرایش کنید.',
          );
        if (!data.category)
          throw new Error(
            'برای تکمیل دسته‌بندی این سند، از بخش اسناد و فایل‌ها استفاده کنید.',
          );
        await documentsApi.update(item.id, {
          title: value.trim(),
          description: data.description ?? '',
          categoryId: data.category.id,
          ownerUserId: data.owner.id,
          confidentiality: data.confidentiality,
          ...(data.validUntil ? { validUntil: data.validUntil } : {}),
          isIncomplete: data.isIncomplete,
          version: item.version,
        });
      }
      setEditor(null);
      setReload((current) => current + 1);
      onNotice(
        mode === 'delete'
          ? 'محتوا از کتابخانه فعال حذف و در اسناد بایگانی شد.'
          : 'عنوان محتوا در اسناد و فایل‌ها به‌روز شد.',
      );
    } catch (reason) {
      setMutationError(
        reason instanceof Error ? reason.message : 'ثبت تغییر انجام نشد.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section dir="rtl" className="grid gap-4 text-right">
      <Card className="flex flex-wrap items-end gap-4 p-5">
        <div className="min-w-60 flex-1">
          <FormField id="content-library-search" label="جست‌وجوی محتوا">
            <Input
              id="content-library-search"
              type="search"
              placeholder="جست‌وجو در نام و مشخصات فایل"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </FormField>
        </div>
        <Button
          size="icon"
          aria-label="بارگذاری فایل"
          title="بارگذاری فایل"
          disabled={adding}
          onClick={onAdd}
        >
          <Plus aria-hidden="true" className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          aria-label="تازه‌سازی محتوا"
          title="تازه‌سازی"
          disabled={loading}
          onClick={() => setReload((current) => current + 1)}
        >
          <RefreshCw aria-hidden="true" className="size-4" />
        </Button>
      </Card>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm" aria-busy={loading}>
            <caption className="sr-only">کتابخانه محتوا</caption>
            <thead className="bg-muted/50">
              <tr>
                {[
                  'عنوان',
                  'نوع سند',
                  'دسته‌بندی',
                  'مالک',
                  'نسخه',
                  'عملیات',
                ].map((label) => (
                  <th scope="col" key={label} className="p-4">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!error &&
                items.map((item) => (
                  <tr key={item.id} className="border-t hover:bg-muted/30">
                    <td className="p-4 font-medium">{item.title}</td>
                    <td className="p-4">{item.type.name}</td>
                    <td className="p-4">{item.category?.name ?? '—'}</td>
                    <td className="p-4">{item.owner.displayName}</td>
                    <td className="p-4">
                      {item.version.toLocaleString('fa-IR')}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          title="مشاهده"
                          aria-label={`مشاهده ${item.title}`}
                          onClick={() => canonical(item)}
                        >
                          <Eye aria-hidden="true" className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          title="ویرایش"
                          aria-label={`ویرایش ${item.title}`}
                          disabled={!item.capabilities.editMetadata || loading}
                          onClick={() => begin(item, 'edit')}
                        >
                          <Pencil aria-hidden="true" className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="destructive"
                          title="حذف از کتابخانه"
                          aria-label={`حذف ${item.title}`}
                          disabled={!item.capabilities.archive || loading}
                          onClick={() => begin(item, 'delete')}
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p role="status" className="p-4 text-muted-foreground">
          {loading
            ? 'در حال دریافت محتوا…'
            : !error && !items.length
              ? 'محتوایی پیدا نشد.'
              : `صفحه ${page.toLocaleString('fa-IR')} از ${pages.toLocaleString('fa-IR')}`}
        </p>
        <div className="flex gap-2 border-t p-4">
          <Button
            size="icon"
            aria-label="صفحه قبل"
            title="صفحه قبل"
            variant="outline"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => current - 1)}
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
          <Button
            size="icon"
            aria-label="صفحه بعد"
            title="صفحه بعد"
            variant="outline"
            disabled={page >= pages || loading}
            onClick={() => setPage((current) => current + 1)}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </Card>
      <Dialog
        open={!!editor}
        onOpenChange={(open) => {
          if (!open && !busy) setEditor(null);
        }}
      >
        <DialogContent dir="rtl" className="text-right">
          <DialogTitle>
            {editor?.mode === 'delete'
              ? 'حذف محتوا از کتابخانه'
              : 'ویرایش عنوان محتوا'}
          </DialogTitle>
          <DialogDescription>
            {editor?.mode === 'delete'
              ? 'فایل بایگانی می‌شود و از بخش اسناد و فایل‌ها قابل بازیابی است.'
              : 'عنوان در کتابخانه و اسناد و فایل‌ها هم‌زمان تغییر می‌کند.'}
          </DialogDescription>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <FormField
              id="library-record-value"
              label={editor?.mode === 'delete' ? 'دلیل حذف' : 'عنوان محتوا'}
              required
            >
              <Input
                id="library-record-value"
                required
                minLength={2}
                value={value}
                disabled={busy}
                onChange={(event) => setValue(event.target.value)}
              />
            </FormField>
            {mutationError ? (
              <p role="alert" className="text-destructive">
                {mutationError}
              </p>
            ) : null}
            <Button
              size="icon"
              type="submit"
              className="justify-self-end"
              aria-label="ثبت تغییر محتوا"
              title="ثبت"
              disabled={busy}
            >
              <Save aria-hidden="true" className="size-4" />
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
