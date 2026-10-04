'use client';
import { NativeSearchSelect } from '@/components/ui/native-search-select';

import { useEffect, useRef, useState } from 'react';
import type { IamPermissionCode, MasterDataRecord } from '@nora/contracts';
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
import { useBoundUploadContext } from './use-bound-upload-context';

export async function issueUploadedConfidentialGrant(
  documentId: string,
  code: string,
  enabled: boolean,
) {
  if (!enabled) return undefined;
  const response = await documentsApi.createAccessGrant(documentId, {
    code,
    purpose: 'CONFIDENTIAL_VIEW',
  });
  return response.data.token;
}

/** Publish the selected ID only after its one-time attachment grant is ready. */
export async function publishUploadedDocumentAfterGrant(
  request: {
    isCurrent: () => boolean;
    publish: (documentId: string, token?: string) => void;
  },
  documentId: string,
  getGrant: () => Promise<string | undefined>,
) {
  let token: string | undefined;
  let grantError: unknown;
  try {
    token = await getGrant();
  } catch (error) {
    grantError = error;
  }
  if (!request.isCurrent()) return { current: false, grantError };
  request.publish(documentId, token);
  return { current: true, grantError };
}

/** Upload through the Documents owner; only its saved ID is attached to the form. */
export function InlineDocumentUpload({
  organizationId,
  branchId,
  label,
  permissions,
  onUploaded,
  onConfidentialGrant,
  onStaged,
  staged,
  onBusyChange,
  onUncertainChange,
  contextKey = '',
  uploadedNotice,
  disabled = false,
  expanded = false,
}: {
  organizationId?: string | undefined;
  branchId: string;
  label: string;
  permissions: readonly IamPermissionCode[];
  onUploaded: (id: string) => void;
  onConfidentialGrant?:
    ((documentId: string, token: string) => void) | undefined;
  onStaged?:
    ((document: StagedOrganizationDocument | null) => void) | undefined;
  staged?: StagedOrganizationDocument | null | undefined;
  onBusyChange: (busy: boolean) => void;
  onUncertainChange?: ((uncertain: boolean) => void) | undefined;
  contextKey?: string | undefined;
  uploadedNotice?: string | undefined;
  disabled?: boolean | undefined;
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
  const [confidentialAccessCode, setConfidentialAccessCode] = useState('');
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(
      staged
        ? 'فایل آماده است و پس از ایجاد سازمان، در اسناد و فایل‌ها ذخیره و متصل می‌شود.'
        : '',
    ),
    [uncertain, setUncertain] = useState(false);
  const bindUpload = useBoundUploadContext(contextKey, {
    onUploaded,
    onConfidentialGrant,
    onBusyChange,
    onUncertainChange,
  });
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
    if (disabled || pending.current || uncertain || !options) return;
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
      ...(type?.defaultConfidentiality === 'CONFIDENTIAL'
        ? { confidentialAccessCode }
        : {}),
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
    const request = bindUpload();
    setBusy(true);
    request.busy(true);
    try {
      const result = await documentsApi.upload(form);
      if (!request.isCurrent()) return;
      let grantError: unknown;
      if (type?.defaultConfidentiality === 'CONFIDENTIAL') {
        const completion = await publishUploadedDocumentAfterGrant(
          request,
          result.data.id,
          () =>
            issueUploadedConfidentialGrant(
            result.data.id,
            confidentialAccessCode,
            Boolean(onConfidentialGrant),
            ),
        );
        if (!completion.current) return;
        grantError = completion.grantError;
        if (!grantError && onConfidentialGrant) setConfidentialAccessCode('');
      } else {
        request.publish(result.data.id);
      }
      setFile(undefined);
      if (grantError !== undefined) {
          setError(
            (grantError instanceof Error
              ? grantError.message
              : 'دریافت مجوز موقت سند ناموفق بود.') +
              ' فایل بارگذاری شده است؛ کد را برای ذخیره قرارداد دوباره وارد کنید.',
          );
      }
      setNotice(
        uploadedNotice ??
          (result.data.currentVersion.scanStatus === 'CLEAN'
            ? 'مدرک در اسناد و فایل‌ها ذخیره و انتخاب شد.'
            : 'مدرک ذخیره و انتخاب شد؛ تأیید قرارداد پس از بررسی امنیتی فایل ممکن است.'),
      );
    } catch (e) {
      if (!request.isCurrent()) return;
      const unknown =
        !(e instanceof DocumentsApiError) || e.status === 0 || e.status >= 500;
      setUncertain(unknown);
      request.uncertain(unknown);
      setError(
        (e instanceof Error ? e.message : 'بارگذاری ناموفق بود.') +
          (unknown
            ? ' نتیجه ثبت مشخص نیست؛ پیش از بارگذاری مجدد، اسناد و فایل‌ها را بررسی کنید.'
            : ''),
      );
    } finally {
      pending.current = false;
      setBusy(false);
      request.releaseBusy();
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
      <fieldset className="mt-3 grid gap-3 sm:grid-cols-2" disabled={disabled}>
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
          <NativeSearchSelect
            className="input"
            value={typeId}
            onChange={(e) => {
              setTypeId(e.target.value);
              setConfidentialAccessCode('');
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
          </NativeSearchSelect>
        </label>
        {type?.defaultConfidentiality === 'CONFIDENTIAL' ? (
          <ConfidentialAccessCodeInput
            value={confidentialAccessCode}
            onChange={setConfidentialAccessCode}
          />
        ) : null}
        <label className="field">
          <span>دسته‌بندی سند</span>
          <NativeSearchSelect
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
          </NativeSearchSelect>
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
      </fieldset>
    </Container>
  );
}

export function ConfidentialAccessCodeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>کد دسترسی سند محرمانه</span>
      <input
        className="input"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        value={value}
        onChange={(event) =>
          onChange(event.target.value.replace(/\D/gu, '').slice(0, 6))
        }
      />
    </label>
  );
}
