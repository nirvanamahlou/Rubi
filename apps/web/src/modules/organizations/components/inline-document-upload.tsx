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
  type OrganizationDocumentOptions,
} from '../model/organization-documents';

/** Upload through the Documents owner; only its saved ID is attached to the form. */
export function InlineDocumentUpload({
  organizationId,
  branchId,
  label,
  permissions,
  onUploaded,
  onBusyChange,
}: {
  organizationId: string;
  branchId: string;
  label: string;
  permissions: readonly IamPermissionCode[];
  onUploaded: (id: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [options, setOptions] = useState<OrganizationDocumentOptions>();
  const [organization, setOrganization] = useState<MasterDataRecord>();
  const [typeId, setTypeId] = useState(''),
    [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState(label),
    [expiry, setExpiry] = useState('');
  const [file, setFile] = useState<File>(),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
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
      masterDataApi.detail('organizations', organizationId),
    ])
      .then(([o, org]) => {
        if (!active) return;
        setOptions(o.data);
        setOrganization(org.data);
        setTypeId(
          o.data.documentTypes.find((t) => t.domain === 'ORGANIZATION')?.id ??
            '',
        );
        setCategoryId(
          o.data.categories.find((c) => c.code === 'ORGANIZATION')?.id ??
            o.data.categories[0]?.id ??
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
    if (pending.current || uncertain || !options || !organization) return;
    setError('');
    setNotice('');
    if (!file) {
      setError('فایل مدرک را انتخاب کنید.');
      return;
    }
    let form: FormData;
    try {
      form = organizationDocumentForm(
        organization,
        {
          title,
          branchId,
          documentTypeId: typeId,
          categoryId,
          validUntil: expiry,
          requiresStepUpVerification: false,
        },
        file,
        options,
        permissions,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فایل معتبر نیست.');
      return;
    }
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
  return (
    <details className="rounded-xl border border-dashed p-3">
      <summary className="cursor-pointer font-semibold">
        بارگذاری فایل جدید برای {label}
      </summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="field">
          <span>عنوان مدرک</span>
          <input
            className="input"
            value={title}
            maxLength={240}
            onChange={(e) => setTitle(e.target.value)}
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
            onChange={(e) => setCategoryId(e.target.value)}
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
            onChange={setExpiry}
          />
        </div>
        <label className="field full">
          <span>فایل {label}</span>
          <input
            key={`${typeId}-${notice}`}
            type="file"
            accept={type?.allowedMimeTypes.join(',')}
            onChange={(e) => setFile(e.target.files?.[0])}
          />
        </label>
        <button
          className="btn"
          type="button"
          disabled={busy || uncertain || !file || !type}
          onClick={() => void upload()}
        >
          {busy ? 'در حال بارگذاری…' : 'بارگذاری و اتصال مدرک'}
        </button>
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
    </details>
  );
}
