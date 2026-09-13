'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { IamPermissionCode, MasterDataRecord } from '@rubi/contracts';
import {
  documentsApi,
  DocumentsApiError,
} from '@/modules/documents/api/client';
import { masterDataApi } from '@/modules/master-data/api/client';
import { DatePicker } from '@/components/ui/date-picker';
import {
  organizationDocumentForm,
  validateOrganizationDocumentInput,
  type OrganizationDocumentOptions,
  type StagedOrganizationDocument,
} from '../model/organization-documents';

/** Upload through the Documents owner; only its saved ID is attached to the form. */
export function InlineDocumentUpload({
  organizationId,
  branchId,
  label,
  permissions,
  onUploaded,
  onStaged,
  staged,
  onBusyChange,
  expanded = false,
}: {
  organizationId?: string | undefined;
  branchId: string;
  label: string;
  permissions: readonly IamPermissionCode[];
  onUploaded: (id: string) => void;
  onStaged?:
    ((document: StagedOrganizationDocument | null) => void) | undefined;
  staged?: StagedOrganizationDocument | null | undefined;
  onBusyChange: (busy: boolean) => void;
  expanded?: boolean;
}) {
  const [options, setOptions] = useState<OrganizationDocumentOptions>();
  const [organization, setOrganization] = useState<MasterDataRecord>();
  const [typeId, setTypeId] = useState(staged?.input.documentTypeId ?? ''),
    [categoryId, setCategoryId] = useState(staged?.input.categoryId ?? '');
  const [title, setTitle] = useState(staged?.input.title ?? label),
    [expiry, setExpiry] = useState(staged?.input.validUntil ?? '');
  const [file, setFile] = useState<File | undefined>(staged?.file),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(
      staged
        ? 'فایل آماده است و پس از ایجاد سازمان، در اسناد و فایل‌ها ذخیره و متصل می‌شود.'
        : '',
    ),
    [uncertain, setUncertain] = useState(false);
  const callbacks = useRef({ onUploaded, onBusyChange });
  useLayoutEffect(() => {
    callbacks.current = { onUploaded, onBusyChange };
  }, [onUploaded, onBusyChange]);
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    void Promise.all([
      documentsApi.options(),
      organizationId
        ? masterDataApi.detail('organizations', organizationId)
        : Promise.resolve(undefined),
    ])
      .then(([o, org]) => {
        if (!active) return;
        setOptions(o.data);
        setOrganization(org?.data);
        setTypeId(
          (current) =>
            current ||
            o.data.documentTypes.find((t) => t.domain === 'ORGANIZATION')?.id ||
            '',
        );
        setCategoryId(
          (current) =>
            current ||
            o.data.categories.find((c) => c.code === 'ORGANIZATION')?.id ||
            o.data.categories[0]?.id ||
            '',
        );
      })
      .catch(() => {
        if (active)
          setError('گزینه‌های بارگذاری دریافت نشد؛ فرم را دوباره باز کنید.');
      });
    return () => {
      active = false;
    };
  }, [organizationId]);
  const type = options?.documentTypes.find((t) => t.id === typeId);
  async function upload() {
    if (pending.current || uncertain || !options) return;
    setError('');
    setNotice('');
    if (!file) {
      setError('فایل مدرک را انتخاب کنید.');
      return;
    }
    const input = {
      title,
      branchId,
      documentTypeId: typeId,
      categoryId,
      validUntil: expiry,
      requiresStepUpVerification: false,
    };
    try {
      validateOrganizationDocumentInput(input, file, options, permissions);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فایل معتبر نیست.');
      return;
    }
    if (!organization) {
      onStaged?.({ input, file });
      setNotice(
        'فایل آماده است و پس از ایجاد سازمان، در اسناد و فایل‌ها ذخیره و متصل می‌شود.',
      );
      return;
    }
    const form = organizationDocumentForm(
      organization,
      input,
      file,
      options,
      permissions,
    );
    pending.current = true;
    setBusy(true);
    callbacks.current.onBusyChange(true);
    try {
      const result = await documentsApi.upload(form);
      callbacks.current.onUploaded(result.data.id);
      setFile(undefined);
      setNotice(
        result.data.currentVersion.scanStatus === 'CLEAN'
          ? 'مدرک در اسناد و فایل‌ها ذخیره و انتخاب شد.'
          : 'مدرک ذخیره و انتخاب شد؛ تأیید قرارداد پس از بررسی امنیتی فایل ممکن است.',
      );
    } catch (e) {
      const unknown =
        !(e instanceof DocumentsApiError) || e.status === 0 || e.status >= 500;
      setUncertain(unknown);
      setError(
        (e instanceof Error ? e.message : 'بارگذاری ناموفق بود.') +
          (unknown
            ? ' نتیجه ثبت مشخص نیست؛ پیش از بارگذاری مجدد، اسناد و فایل‌ها را بررسی کنید.'
            : ''),
      );
    } finally {
      pending.current = false;
      setBusy(false);
      callbacks.current.onBusyChange(false);
    }
  }
  const Container = expanded ? 'div' : 'details';
  return (
    <Container className="rounded-xl border border-dashed p-3">
      {expanded ? (
        <p className="font-semibold">اطلاعات و فایل {label}</p>
      ) : (
        <summary className="cursor-pointer font-semibold">
          بارگذاری فایل جدید برای {label}
        </summary>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="field">
          <span>عنوان مدرک</span>
          <input
            className="input"
            value={title}
            maxLength={240}
            onChange={(e) => {
              setTitle(e.target.value);
              onStaged?.(null);
              setNotice('');
            }}
          />
        </label>
        <label className="field">
          <span>نوع مدرک</span>
          <select
            className="input"
            value={typeId}
            onChange={(e) => {
              setTypeId(e.target.value);
              setFile(undefined);
              onStaged?.(null);
              setNotice('');
            }}
          >
            <option value="">انتخاب نوع مدرک</option>
            {options?.documentTypes
              .filter((t) => t.domain === 'ORGANIZATION')
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        </label>
        <label className="field">
          <span>دسته‌بندی سند</span>
          <select
            className="input"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              onStaged?.(null);
              setNotice('');
            }}
          >
            {options?.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>انقضای مدرک {type?.requiresExpiry ? '*' : '(اختیاری)'}</span>
          <DatePicker
            withinDialog
            aria-label={`انقضای مدرک ${label}`}
            value={expiry}
            onChange={(next) => {
              setExpiry(next);
              onStaged?.(null);
              setNotice('');
            }}
          />
        </div>
        <label className="field full">
          <span>فایل {label}</span>
          <input
            key={typeId}
            type="file"
            accept={type?.allowedMimeTypes.join(',')}
            onChange={(e) => {
              setFile(e.target.files?.[0]);
              onStaged?.(null);
              setNotice('');
            }}
          />
        </label>
        <button
          className="btn"
          type="button"
          disabled={busy || uncertain || !file || !type}
          onClick={() => void upload()}
        >
          {busy
            ? 'در حال بارگذاری…'
            : organization
              ? 'بارگذاری و اتصال مدرک'
              : 'افزودن فایل به فرم'}
        </button>
        {!organization ? (
          <small className="full">
            فایل هنگام ذخیره پرونده و پس از تخصیص شناسه سازمان بارگذاری می‌شود.
          </small>
        ) : null}
        {error ? (
          <p role="alert" className="form-error full">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="full">
            {notice}
          </p>
        ) : null}
      </div>
    </Container>
  );
}
