'use client';

import type { IamPermissionCode, MasterDataRecord } from '@rubi/contracts';
import { Building2, Camera, ImagePlus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import {
  masterDataApi,
  type MasterDataLogoChange,
} from '@/modules/master-data/api/client';
import {
  canUploadOrganizationLogo,
  canViewOrganizationLogo,
  organizationLogoFileIssue,
  organizationLogoPreview,
  saveOrganizationLogo,
} from '../model/organization-logo';

export function OrganizationLogo({
  organization,
  permissions,
  onSaved,
}: {
  organization: MasterDataRecord;
  permissions: readonly IamPermissionCode[];
  onSaved: (record: MasterDataRecord) => void;
}) {
  const reference = String(
    organization.attributes.logoFileReference ?? '',
  ).trim();
  const [image, setImage] = useState<{ reference: string; url: string }>();
  const [imageNotice, setImageNotice] = useState('');
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  function openEditor(button: HTMLButtonElement) {
    opener.current = button;
    setNotice('');
    setOpen(true);
  }
  const canUpload = canUploadOrganizationLogo(permissions);
  const canRemove = !!reference && permissions.includes('master_data.update');
  useEffect(() => {
    if (!reference) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void organizationLogoPreview(reference, permissions, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        if ('blob' in result) {
          objectUrl = URL.createObjectURL(result.blob);
          setImage({ reference, url: objectUrl });
          setImageNotice('');
        } else {
          setImage(undefined);
          setImageNotice(result.reason);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setImage(undefined);
          setImageNotice(
            'تصویر لوگو اکنون قابل دریافت نیست؛ وضعیت فایل را در آرشیو بررسی کنید.',
          );
        }
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [reference, permissions, organization.version]);
  const visibleImage =
    canViewOrganizationLogo(permissions) &&
    reference &&
    image?.reference === reference
      ? image.url
      : undefined;
  return (
    <div className="organization-logo-control">
      <button
        className="org-logo organization-logo-trigger"
        type="button"
        title={reference ? imageNotice : 'بارگذاری لوگوی سازمان'}
        disabled={!canUpload && !canRemove}
        onClick={(event) => openEditor(event.currentTarget)}
        aria-label={`${reference ? 'تغییر' : 'بارگذاری'} لوگوی ${organization.name}`}
      >
        {visibleImage ? (
          <Image
            src={visibleImage}
            alt={`لوگوی ${organization.name}`}
            width={64}
            height={64}
            unoptimized
            className="organization-logo-image"
          />
        ) : (
          <Building2 size={30} aria-hidden="true" />
        )}
        {(canUpload || canRemove) && (
          <span className="logo-camera">
            <Camera size={13} aria-hidden="true" />
          </span>
        )}
      </button>
      <button
        type="button"
        className="logo-action"
        disabled={!canUpload && !canRemove}
        onClick={(event) => openEditor(event.currentTarget)}
      >
        {reference ? 'تغییر لوگو' : 'بارگذاری لوگو'}
      </button>
      {reference && (
        <Link
          className="logo-archive-link"
          href={`/documents?document=${encodeURIComponent(reference)}`}
        >
          آرشیو لوگو
        </Link>
      )}
      {reference && imageNotice && (
        <span className="sr-only" role="status">
          {imageNotice}
        </span>
      )}
      {notice && (
        <span className="max-w-40 text-center text-xs" role="status">
          {notice}
        </span>
      )}
      {open && (
        <LogoDialog
          organization={organization}
          permissions={permissions}
          savedImage={visibleImage}
          savedNotice={imageNotice}
          onReturnFocus={() => opener.current?.focus()}
          onClose={(refresh) => {
            setOpen(false);
            if (refresh)
              void masterDataApi
                .detail('organizations', organization.id)
                .then((result) => onSaved(result.data))
                .catch(() =>
                  setNotice(
                    'تازه‌سازی پرونده ناموفق بود؛ پیش از ذخیره دوباره، فهرست سازمان‌ها را تازه‌سازی کنید.',
                  ),
                );
          }}
          onSaved={(record, warning) => {
            onSaved(record);
            setNotice(
              warning ??
                (record.attributes.logoFileReference
                  ? 'لوگوی پرونده ذخیره شد.'
                  : 'لوگو از پرونده برداشته شد.'),
            );
            if (!warning) setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function LogoDialog({
  organization,
  permissions,
  savedImage,
  savedNotice,
  onReturnFocus,
  onClose,
  onSaved,
}: {
  organization: MasterDataRecord;
  permissions: readonly IamPermissionCode[];
  savedImage: string | undefined;
  savedNotice: string;
  onReturnFocus: () => void;
  onClose: (refresh: boolean) => void;
  onSaved: (record: MasterDataRecord, warning?: string) => void;
}) {
  const [change, setChange] = useState<MasterDataLogoChange>();
  const [preview, setPreview] = useState<{ file: File; url: string }>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const pending = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const file = change?.kind === 'replace' ? change.file : undefined;
  const reference = String(organization.attributes.logoFileReference ?? '');
  const canUpload = canUploadOrganizationLogo(permissions);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const timer = window.setTimeout(() => setPreview({ file, url }), 0);
    return () => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
    };
  }, [file]);
  const imageUrl =
    change?.kind === 'remove'
      ? undefined
      : file
        ? preview?.file === file
          ? preview.url
          : undefined
        : savedImage;
  async function save() {
    if (!change || pending.current || attempted) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setAttempted(true);
    try {
      const result = await saveOrganizationLogo(
        organization,
        change,
        permissions,
      );
      onSaved(result.data, result.warning);
      if (result.warning) setError(result.warning);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'ذخیره لوگو تأیید نشد.',
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value && !pending.current) onClose(attempted);
      }}
    >
      <DialogContent
        className="b2b-design b2b-modal organization-logo-modal"
        dir="rtl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          if (pending.current) event.preventDefault();
        }}
      >
        <DialogTitle>لوگوی {organization.name}</DialogTitle>
        <DialogDescription>
          تصویر PNG یا JPEG با حجم حداکثر ۵ مگابایت انتخاب کنید. لوگو در سربرگ
          پرونده نمایش داده می‌شود.
        </DialogDescription>
        <div className="logo-editor-preview">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={
                file
                  ? 'پیش‌نمایش لوگوی انتخاب‌شده'
                  : `لوگوی ${organization.name}`
              }
              width={160}
              height={160}
              unoptimized
            />
          ) : (
            <ImagePlus size={54} aria-hidden="true" />
          )}
        </div>
        <p className="text-center text-sm text-muted-foreground">
          {change?.kind === 'remove'
            ? 'لوگو پس از ذخیره از پرونده برداشته می‌شود.'
            : file
              ? file.name
              : reference
                ? savedNotice || 'لوگوی فعلی پرونده'
                : 'هنوز لوگویی ثبت نشده است.'}
        </p>
        <label className="logo-file-field">
          <span>انتخاب تصویر لوگو</span>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg"
            disabled={!canUpload || busy || attempted}
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (!selected) return;
              const issue = organizationLogoFileIssue(selected);
              if (issue) {
                setError(issue);
                event.target.value = '';
                return;
              }
              setError('');
              setChange({ kind: 'replace', file: selected });
            }}
          />
        </label>
        {!canUpload && (
          <p className="text-sm text-muted-foreground">
            برای بارگذاری، مجوز ویرایش سازمان و بارگذاری اسناد برند لازم است.
          </p>
        )}
        {reference && (
          <Button
            variant="outline"
            disabled={
              busy || attempted || !permissions.includes('master_data.update')
            }
            onClick={() => {
              setChange({ kind: 'remove' });
              setError('');
              if (fileInput.current) fileInput.current.value = '';
            }}
          >
            <Trash2 className="size-4" /> برداشتن لوگوی فعلی
          </Button>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
            {attempted
              ? ' برای بررسی نتیجه، این پنجره را ببندید و پرونده را تازه‌سازی کنید.'
              : ''}
          </p>
        )}
        <div className="flex justify-between gap-3 pt-3">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => onClose(attempted)}
          >
            بستن
          </Button>
          <Button
            disabled={!change || attempted}
            loading={busy}
            onClick={() => void save()}
          >
            ذخیره لوگو
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
