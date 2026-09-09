'use client';

import type {
  DocumentListItemV1,
  DocumentValidityFilter,
  IamPermissionCode,
  MasterDataRecord,
} from '@rubi/contracts';
import { FileText, FileUp, RefreshCw, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import {
  documentsApi,
  DocumentsApiError,
} from '@/modules/documents/api/client';
import { agencyClient } from '../api/agency-client';
import {
  canReadOrganizationDocuments,
  organizationDocumentForm,
  organizationDocumentQuery,
  type OrganizationDocumentInput,
  type OrganizationDocumentOptions,
} from '../model/organization-documents';

const scanLabels: Record<
  DocumentListItemV1['currentVersion']['scanStatus'],
  string
> = {
  CLEAN: 'بررسی‌شده',
  PENDING_SCAN: 'در صف بررسی',
  QUARANTINED: 'قرنطینه',
  INFECTED: 'فایل آلوده',
  SCAN_FAILED: 'بررسی ناموفق',
  AWAITING_ANTIVIRUS_ADAPTER: 'در انتظار آنتی‌ویروس',
};
function failure(error: unknown): string {
  if (error instanceof DocumentsApiError && error.status === 401)
    return 'نشست معتبر نیست؛ دوباره وارد سامانه شوید.';
  if (error instanceof DocumentsApiError && error.status === 403)
    return 'مجوز مشاهده یا بارگذاری سند در این شعبه را ندارید.';
  return error instanceof Error ? error.message : 'دریافت اسناد ناموفق بود.';
}

export function OrganizationDocumentsPanel({
  organization,
}: {
  organization: MasterDataRecord;
}) {
  const [options, setOptions] = useState<OrganizationDocumentOptions>();
  const [permissions, setPermissions] = useState<readonly IamPermissionCode[]>(
    [],
  );
  const [branch, setBranch] = useState('');
  const [page, setPage] = useState(1);
  const [validity, setValidity] = useState<DocumentValidityFilter>('ALL');
  const [records, setRecords] = useState<readonly DocumentListItemV1[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [upload, setUpload] = useState(false);
  const [revision, setRevision] = useState(0);
  const request = useRef(0);
  const invalidateRequests = useCallback(() => {
    ++request.current;
  }, []);
  const load = useCallback(async () => {
    const sequence = ++request.current;
    setLoading(true);
    setRecords([]);
    setError('');
    try {
      const session = await agencyClient.session();
      if (sequence !== request.current) return;
      setPermissions(session.permissions);
      if (!canReadOrganizationDocuments(session.permissions))
        throw new Error('مجوز فهرست اسناد سازمان را ندارید.');
      const response = await documentsApi.options();
      if (sequence !== request.current) return;
      const accessible = response.data.branches.filter((item) =>
        session.branches.some((allowed) => allowed.id === item.id),
      );
      const selectedBranch =
        accessible.find((item) => item.id === branch)?.id ?? accessible[0]?.id;
      if (!selectedBranch)
        throw new Error('شعبه مجاز برای اسناد سازمان وجود ندارد.');
      setOptions({ ...response.data, branches: accessible });
      if (branch !== selectedBranch) {
        setBranch(selectedBranch);
        return;
      }
      const list = await documentsApi.list(
        organizationDocumentQuery(
          organization.id,
          selectedBranch,
          page,
          validity,
        ),
      );
      if (sequence !== request.current) return;
      setRecords(list.data);
      setTotal(list.meta.total);
    } catch (caught) {
      if (sequence === request.current) {
        setTotal(0);
        setError(failure(caught));
      }
    } finally {
      if (sequence === request.current) setLoading(false);
    }
  }, [organization.id, branch, page, validity]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(timer);
      invalidateRequests();
    };
  }, [load, revision, invalidateRequests]);
  return (
    <section className="panel" aria-label="اسناد سازمان">
      <header className="panel-head">
        <div>
          <h2 className="panel-title">
            <FileText size={20} /> اسناد سازمان و همکاری
          </h2>
          <p className="panel-note">
            قرارداد، الحاقیه، مجوز و تضمین؛ نسخه‌ها و دریافت فایل در آرشیو اسناد
            در دسترس‌اند.
          </p>
        </div>
        <Button
          onClick={() => {
            setNotice('');
            setUpload(true);
          }}
          disabled={
            loading ||
            !!error ||
            !options ||
            !permissions.includes('documents.upload')
          }
        >
          <FileUp className="size-4" /> بارگذاری سند
        </Button>
      </header>
      <div className="panel-body space-y-4">
        <div className="grid items-end gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-sm">
            شعبه سند
            <select
              aria-label="شعبه سند"
              className="h-11 w-full rounded-xl border bg-surface px-3"
              value={branch}
              disabled={loading}
              onChange={(event) => {
                setPage(1);
                setBranch(event.target.value);
                setNotice('');
              }}
            >
              {options?.branches.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            اعتبار زمانی
            <select
              aria-label="اعتبار زمانی اسناد"
              className="h-11 w-full rounded-xl border bg-surface px-3"
              value={validity}
              disabled={loading}
              onChange={(event) => {
                setPage(1);
                setValidity(event.target.value as DocumentValidityFilter);
              }}
            >
              <option value="ALL">همه اسناد فعال</option>
              <option value="EXPIRING">نزدیک به انقضا</option>
              <option value="EXPIRED">منقضی‌شده</option>
              <option value="VALID">معتبر</option>
              <option value="WITHOUT_EXPIRY">بدون انقضا</option>
            </select>
          </label>
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => setRevision((value) => value + 1)}
          >
            <RefreshCw className="size-4" /> تازه‌سازی
          </Button>
        </div>
        {notice && (
          <p role="status" className="text-sm text-emerald-700">
            {notice}
          </p>
        )}
        {error ? (
          <p role="alert" className="form-error">
            {error}
          </p>
        ) : loading ? (
          <p role="status">در حال دریافت اسناد…</p>
        ) : records.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {records.map((record) => (
              <article
                key={record.id}
                className="min-w-0 space-y-2 rounded-xl border p-4 text-sm"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <h3 className="font-bold break-words">{record.title}</h3>
                  <span
                    className={`badge ${record.currentVersion.scanStatus === 'CLEAN' ? 'success' : 'warning'}`}
                  >
                    {scanLabels[record.currentVersion.scanStatus]}
                  </span>
                </div>
                <p>
                  {record.type.name} · <bdi>{record.archiveCode}</bdi> · نسخه{' '}
                  {record.currentVersion.versionNumber.toLocaleString('fa-IR')}
                </p>
                <p>
                  انقضا:{' '}
                  {record.validUntil
                    ? new Date(record.validUntil).toLocaleDateString('fa-IR')
                    : 'بدون انقضا'}
                  {record.isIncomplete ? ' · پرونده ناقص' : ''}
                </p>
                {record.requiresStepUpVerification && (
                  <p className="text-muted-foreground">
                    دریافت فایل نیازمند اعتبارسنجی دومرحله‌ای است.
                  </p>
                )}
                <Link
                  className="inline-flex items-center gap-2 font-semibold text-primary underline"
                  href={`/documents?document=${encodeURIComponent(record.id)}`}
                >
                  <ExternalLink className="size-4" /> جزئیات، نسخه‌ها و دریافت
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-muted-foreground">
            سندی مطابق این فیلتر برای سازمان و شعبه انتخاب‌شده پیدا نشد.
          </p>
        )}
        {!error && !loading && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm">
              {total.toLocaleString('fa-IR')} سند · صفحه{' '}
              {page.toLocaleString('fa-IR')}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage((value) => value - 1)}
              >
                قبلی
              </Button>
              <Button
                variant="outline"
                disabled={page * 20 >= total}
                onClick={() => setPage((value) => value + 1)}
              >
                بعدی
              </Button>
            </div>
          </div>
        )}
      </div>
      {upload && options && (
        <OrganizationDocumentUpload
          organization={organization}
          branchId={branch}
          options={options}
          permissions={permissions}
          onClose={() => setUpload(false)}
          onSaved={() => {
            setUpload(false);
            setNotice(
              'سند در آرشیو ثبت شد؛ قابل دریافت بودن فایل به نتیجه بررسی امنیتی بستگی دارد.',
            );
            setPage(1);
            setValidity('ALL');
            setRevision((value) => value + 1);
          }}
        />
      )}
    </section>
  );
}

function OrganizationDocumentUpload({
  organization,
  branchId,
  options,
  permissions,
  onClose,
  onSaved,
}: {
  organization: MasterDataRecord;
  branchId: string;
  options: OrganizationDocumentOptions;
  permissions: readonly IamPermissionCode[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const types = options.documentTypes.filter(
    (type) => type.domain === 'ORGANIZATION',
  );
  const [values, setValues] = useState<OrganizationDocumentInput>({
    title: '',
    branchId,
    documentTypeId: types[0]?.id ?? '',
    categoryId:
      options.categories.find((item) => item.code === 'ORGANIZATION')?.id ??
      options.categories[0]?.id ??
      '',
    validUntil: '',
    requiresStepUpVerification: false,
  });
  const [file, setFile] = useState<File>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const pending = useRef(false);
  const type = types.find((item) => item.id === values.documentTypeId);
  const maxSize = Math.min(
    type?.maxFileSizeBytes ?? 0,
    options.uploadPolicy.maxFileSizeBytes,
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || uncertain) return;
    setError('');
    let form: FormData;
    try {
      if (!file) throw new Error('فایل سند را انتخاب کنید.');
      form = organizationDocumentForm(
        organization,
        values,
        file,
        options,
        permissions,
      );
    } catch (caught) {
      setError(failure(caught));
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      await documentsApi.upload(form);
      onSaved();
    } catch (caught) {
      const mayHaveCommitted =
        !(caught instanceof DocumentsApiError) ||
        caught.status === 0 ||
        caught.status >= 500;
      setUncertain(mayHaveCommitted);
      setError(
        `${failure(caught)}${mayHaveCommitted ? ' نتیجه ثبت مشخص نیست؛ فرم را ببندید و فهرست را تازه‌سازی کنید تا فایل تکراری ثبت نشود.' : ''}`,
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending.current) onClose();
      }}
    >
      <DialogContent
        className="b2b-design b2b-modal organization-document-modal"
        dir="rtl"
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          if (pending.current) event.preventDefault();
        }}
      >
        <DialogTitle>بارگذاری سند سازمان</DialogTitle>
        <DialogDescription>
          سند به «{organization.name}» در شعبه انتخاب‌شده متصل می‌شود. ثبت سند
          به معنی تأیید قرارداد یا تضمین نیست.
        </DialogDescription>
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <fieldset
            disabled={busy || uncertain}
            className="grid gap-4 sm:grid-cols-2"
          >
            <label className="field sm:col-span-2">
              <span>عنوان سند *</span>
              <input
                required
                minLength={2}
                maxLength={240}
                value={values.title}
                onChange={(event) =>
                  setValues({ ...values, title: event.target.value })
                }
              />
            </label>
            <label className="field">
              <span>نوع سند *</span>
              <select
                required
                value={values.documentTypeId}
                onChange={(event) => {
                  setValues({ ...values, documentTypeId: event.target.value });
                  setFile(undefined);
                }}
              >
                <option value="">انتخاب نوع سند</option>
                {types.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>دسته‌بندی *</span>
              <select
                required
                value={values.categoryId}
                onChange={(event) =>
                  setValues({ ...values, categoryId: event.target.value })
                }
              >
                <option value="">انتخاب دسته</option>
                {options.categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>
                تاریخ انقضا {type?.requiresExpiry ? '*' : '(اختیاری)'}
              </span>
              <DatePicker
                value={values.validUntil}
                onChange={(value) =>
                  setValues({ ...values, validUntil: value })
                }
                required={type?.requiresExpiry ?? false}
              />
            </label>
            <label className="field">
              <span>فایل سند *</span>
              <input
                key={values.documentTypeId}
                type="file"
                required
                accept={type?.allowedMimeTypes.join(',')}
                onChange={(event) => setFile(event.target.files?.[0])}
              />
              <small>
                حداکثر {(maxSize / 1024 / 1024).toLocaleString('fa-IR')}{' '}
                مگابایت؛ طبقه‌بندی مطابق نوع سند.
              </small>
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={values.requiresStepUpVerification}
                onChange={(event) =>
                  setValues({
                    ...values,
                    requiresStepUpVerification: event.target.checked,
                  })
                }
              />{' '}
              مشاهده و دانلود با اعتبارسنجی دومرحله‌ای
            </label>
          </fieldset>
          {!types.length && (
            <p role="alert">نوع سند سازمان در دسترسی فعلی تعریف نشده است.</p>
          )}
          <div className="flex justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              بستن
            </Button>
            <Button type="submit" loading={busy} disabled={uncertain || !type}>
              ثبت سند
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
