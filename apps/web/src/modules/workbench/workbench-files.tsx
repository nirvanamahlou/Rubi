'use client';

import type {
  DocumentListResponseV1,
  DocumentOptionsResponseV1,
  DocumentPersonalViewCode,
  LoginResponse,
} from '@rubi/contracts';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  RefreshCw,
  Search,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { documentsApi } from '@/modules/documents/api/client';
import { DocumentUploadDialog } from '@/modules/documents/components/document-upload-dialog';
import { workbenchDate } from './model';

export function WorkbenchFiles({
  user,
  onChange,
}: {
  user: LoginResponse['user'];
  onChange: () => void;
}) {
  const [view, setView] = useState<DocumentPersonalViewCode>('OWNED');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState({ search: '', page: 1 });
  const [data, setData] = useState<DocumentListResponseV1 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [options, setOptions] = useState<
    DocumentOptionsResponseV1['data'] | null
  >(null);
  const generation = useRef(0);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  const canRead = user.permissions.includes('documents.metadata.read');
  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setData(null);
    setError('');
    if (!canRead) {
      setLoading(false);
      return;
    }
    try {
      const response = await documentsApi.list({
        ...query,
        personalView: view,
        pageSize: 10,
        sortBy: 'updatedAt',
        sortDirection: 'desc',
      });
      if (current === generation.current) setData(response);
    } catch (reason) {
      if (current === generation.current)
        setError(
          reason instanceof Error
            ? reason.message
            : 'دریافت فایل‌ها انجام نشد.',
        );
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [canRead, query, view]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => {
      clearTimeout(timer);
      invalidate();
    };
  }, [load, invalidate]);

  async function openUpload() {
    setUploadBusy(true);
    setUploadError('');
    setFeedback('');
    try {
      setOptions((await documentsApi.options()).data);
      setUploadOpen(true);
    } catch (reason) {
      setUploadError(
        reason instanceof Error ? reason.message : 'فرم بارگذاری دریافت نشد.',
      );
    } finally {
      setUploadBusy(false);
    }
  }
  async function upload(form: FormData) {
    setUploadBusy(true);
    setUploadError('');
    try {
      await documentsApi.upload(form);
      setUploadOpen(false);
      setFeedback(
        'سند ثبت شد. وضعیت بررسی فایل در پرونده سند قابل پیگیری است.',
      );
      await load();
      onChange();
      return true;
    } catch (reason) {
      setUploadError(
        reason instanceof Error ? reason.message : 'بارگذاری انجام نشد.',
      );
      return false;
    } finally {
      setUploadBusy(false);
    }
  }
  if (!canRead)
    return (
      <EmptyState
        title="دسترسی به فایل‌ها ندارید"
        description="برای مشاهده فایل‌ها، دسترسی اسناد باید برای حساب شما فعال باشد."
      />
    );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-lg">فایل‌های من</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            فایل‌های این بخش در آرشیو اصلی «اسناد و فایل‌ها» ثبت می‌شوند و از
            همان پرونده قابل مشاهده و دریافت هستند.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/documents">اسناد و فایل‌ها</Link>
          </Button>
          {user.permissions.includes('documents.upload') && (
            <Button disabled={uploadBusy} onClick={() => void openUpload()}>
              <Upload className="size-4" aria-hidden="true" />
              بارگذاری سند
            </Button>
          )}
        </div>
      </div>
      {feedback && <Alert title={feedback} />}
      {uploadError && !uploadOpen && (
        <Alert
          tone="error"
          title="بارگذاری آماده نشد"
          description={uploadError}
        />
      )}
      <Card className="p-4 space-y-4">
        <Tabs
          value={view}
          onValueChange={(value) => {
            setView(value as DocumentPersonalViewCode);
            setQuery((current) => ({ ...current, page: 1 }));
          }}
          dir="rtl"
        >
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="OWNED">اسناد من</TabsTrigger>
            <TabsTrigger value="UPLOADED">بارگذاری‌های من</TabsTrigger>
            <TabsTrigger value="RECENTLY_VIEWED">اخیراً دیده‌شده</TabsTrigger>
          </TabsList>
        </Tabs>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery({ search: search.trim(), page: 1 });
          }}
        >
          <Input
            aria-label="جست‌وجوی فایل‌های من"
            placeholder="عنوان، کد آرشیو یا نام فایل"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button type="submit" variant="outline">
            <Search className="size-4" aria-hidden="true" />
            جست‌وجو
          </Button>
        </form>
      </Card>
      {loading ? (
        <Skeleton className="h-56" />
      ) : error ? (
        <Alert title="فایل‌ها دریافت نشدند" description={error} tone="error">
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => void load()}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            تلاش دوباره
          </Button>
        </Alert>
      ) : (
        data && (
          <>
            <Card className="divide-y divide-border overflow-hidden">
              {data.data.length === 0 ? (
                <EmptyState
                  title="فایلی پیدا نشد"
                  description="فیلترها را تغییر دهید یا یک سند جدید بارگذاری کنید."
                />
              ) : (
                data.data.map((item) => (
                  <article
                    key={item.id}
                    className="flex flex-wrap items-center gap-4 p-4"
                  >
                    <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                      <FileText className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold break-words">
                        {item.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.archiveCode} · {item.type.name} ·{' '}
                        {workbenchDate(item.updatedAt)}
                      </p>
                    </div>
                    {item.requiresStepUpVerification && (
                      <Badge>نیازمند تأیید دسترسی</Badge>
                    )}
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={`/documents?document=${encodeURIComponent(item.id)}`}
                      >
                        مشاهده و دریافت
                      </Link>
                    </Button>
                  </article>
                ))
              )}
            </Card>
            <nav
              aria-label="صفحه‌بندی فایل‌ها"
              className="flex flex-wrap justify-between items-center gap-3 text-sm"
            >
              <span className="text-muted-foreground">
                {data.meta.total.toLocaleString('fa-IR')} سند · صفحه{' '}
                {query.page.toLocaleString('fa-IR')}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={query.page <= 1}
                  onClick={() =>
                    setQuery((current) => ({
                      ...current,
                      page: current.page - 1,
                    }))
                  }
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                  قبلی
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={query.page >= data.meta.totalPages}
                  onClick={() =>
                    setQuery((current) => ({
                      ...current,
                      page: current.page + 1,
                    }))
                  }
                >
                  بعدی
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </nav>
          </>
        )
      )}
      {uploadOpen && (
        <DocumentUploadDialog
          open
          options={options}
          branches={user.branches}
          error={uploadError}
          submitting={uploadBusy}
          onOpenChange={(open) => {
            if (!uploadBusy) setUploadOpen(open);
          }}
          onSubmit={upload}
        />
      )}
    </div>
  );
}
