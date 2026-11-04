'use client';

import { useEffect, useState } from 'react';
import type {
  IntegrationSystemConfigV1,
  SiteConnectionInputV1,
  SiteConnectionStatusV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { Alert, Badge, Card } from '@/components/ui/surfaces';
import { siteConnectionApi } from '../api/client';

const fields = [
  ['origin', 'نشانی HTTPS سایت'],
  ['client', 'شناسه کلاینت API'],
  ['system', 'شناسه سامانه در سایت'],
  ['organization', 'شناسه سازمان در سایت'],
  ['environment', 'شناسه محیط اتصال'],
  ['keyId', 'شناسه کلید API'],
] as const;

export function SiteApiConnection({
  branchId,
  system,
  onSaved,
}: {
  branchId: string;
  system: IntegrationSystemConfigV1;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<SiteConnectionStatusV1 | null>(null);
  const [form, setForm] = useState<SiteConnectionInputV1>({
    expectedVersion: 0,
    origin: system.setup?.websiteUrl ?? '',
    client: 'nora',
    system: '',
    organization: '',
    environment: 'production',
    keyId: '',
    secret: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [verified, setVerified] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const control = new AbortController();
    void siteConnectionApi
      .status(branchId, system.id, control.signal)
      .then((value) => {
        if (control.signal.aborted) return;
        setStatus(value);
        setForm({
          origin: system.setup?.websiteUrl ?? '',
          client: 'nora',
          system: '',
          organization: '',
          environment: 'production',
          keyId: '',
          ...value.connection,
          expectedVersion: value.version,
          secret: '',
        });
        setDirty(false);
        setError('');
      })
      .catch((cause) => {
        if (!control.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : 'دریافت تنظیمات اتصال انجام نشد.',
          );
      });
    return () => control.abort();
  }, [branchId, system.id, system.setup?.websiteUrl, revision]);
  async function save() {
    setBusy(true);
    setError('');
    setNotice('');
    setVerified(false);
    try {
      const saved = await siteConnectionApi.save(branchId, system.id, form);
      setStatus(saved);
      setForm({
        ...form,
        ...saved.connection,
        expectedVersion: saved.version,
        secret: '',
      });
      setDirty(false);
      setNotice(
        'اطلاعات اتصال رمز‌شده ذخیره شد؛ اکنون آزمون اتصال را اجرا کنید.',
      );
      onSaved();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'ذخیره اتصال انجام نشد.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function test() {
    setBusy(true);
    setError('');
    setNotice('');
    setVerified(false);
    try {
      const result = await siteConnectionApi.test(branchId, system.id);
      if (result.state !== 'CONNECTED')
        throw new Error('اطلاعات اتصال این سایت هنوز ثبت نشده است.');
      setVerified(true);
      setNotice('پاسخ API سایت و امضای اتصال تأیید شد.');
      onSaved();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'آزمون اتصال موفق نبود.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="grid gap-4 p-5">
      <h2 className="text-lg font-bold">اتصال API {system.name}</h2>
      <p className="text-sm leading-7 text-muted-foreground">
        شناسه‌ها و کلید امضای ERP v1 را از تنظیمات API همین سایت بردارید. مسئول
        عملیات، کاربر واردشدهٔ نوراست.
      </p>
      {status?.configured ? (
        <Badge>
          {verified
            ? 'اتصال API تأیید شد'
            : 'اطلاعات اتصال ثبت شده؛ نیازمند آزمون'}
        </Badge>
      ) : null}
      {status && !status.storageReady ? (
        <Alert tone="error" title="نگهداری امن اتصال روی سرور آماده نیست." />
      ) : null}
      {status && !status.canManage ? (
        <p className="text-sm text-muted-foreground">
          برای ثبت یا تغییر اتصال، مجوز مدیریت یکپارچه‌سازی لازم است.
        </p>
      ) : null}
      {error ? (
        <Alert
          tone="error"
          title="عملیات اتصال انجام نشد"
          description={error}
        />
      ) : null}
      {notice ? (
        <p role="status" className="text-sm">
          {notice}
        </p>
      ) : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset
          disabled={!status?.canManage || !status.storageReady || busy}
          className="grid gap-4 md:grid-cols-2"
        >
          {fields.map(([key, label]) => (
            <label key={key} className="grid gap-2 text-sm">
              {label}
              <Input
                dir="ltr"
                autoComplete="off"
                required
                maxLength={key === 'origin' ? 2048 : 120}
                type={key === 'origin' ? 'url' : 'text'}
                value={form[key]}
                onChange={(event) => {
                  setForm({ ...form, [key]: event.target.value });
                  setDirty(true);
                  setVerified(false);
                  setNotice('');
                }}
              />
            </label>
          ))}
          <label className="grid gap-2 text-sm md:col-span-2">
            کلید محرمانه امضای API
            <Input
              dir="ltr"
              type="password"
              autoComplete="new-password"
              required={!status?.secretConfigured}
              minLength={32}
              maxLength={4096}
              value={form.secret}
              onChange={(event) => {
                setForm({ ...form, secret: event.target.value });
                setDirty(true);
                setVerified(false);
                setNotice('');
              }}
            />
          </label>
          <p className="text-xs text-muted-foreground md:col-span-2">
            کلید ذخیره‌شده نمایش داده نمی‌شود. برای حفظ کلید فعلی، این کادر را
            خالی بگذارید؛ تغییر نشانی یا شناسه‌های اتصال به ورود دوبارهٔ کلید
            نیاز دارد.
          </p>
          <Button type="submit" disabled={!dirty}>
            ذخیره امن اطلاعات اتصال
          </Button>
        </fieldset>
      </form>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          disabled={busy || !status?.configured || dirty}
          onClick={() => void test()}
        >
          آزمون اتصال همین سایت
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            setNotice('');
            setVerified(false);
            setStatus(null);
            setRevision((value) => value + 1);
          }}
        >
          بارگذاری تنظیمات ذخیره‌شده
        </Button>
      </div>
    </Card>
  );
}
