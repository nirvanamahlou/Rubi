'use client';

import type {
  DocumentAccessPurposeCode,
  DocumentDetailV1,
  IamMfaSetupBeginResponseV1,
} from '@rubi/contracts';
import { KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

import { documentsApi, DocumentsApiError } from '../api/client';
import { iamMfaApi } from '../api/iam-mfa-client';

import { Alert, Button, Input } from '@/components/ui';

type SetupData = IamMfaSetupBeginResponseV1['data'];

function normalizeCode(value: string): string {
  return value.replace(/\D/gu, '').slice(0, 6);
}

export function DocumentStepUpForm({
  document,
  onGranted,
  purpose,
}: {
  document: DocumentDetailV1;
  onGranted: (token: string) => Promise<void> | void;
  purpose: DocumentAccessPurposeCode;
}) {
  const [phase, setPhase] = useState<'checking' | 'verify' | 'enroll'>(
    'checking',
  );
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void iamMfaApi
      .status()
      .then((response) => {
        if (active) setPhase(response.data.enabled ? 'verify' : 'enroll');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setMessage(
          error instanceof Error
            ? error.message
            : 'بررسی وضعیت Authenticator ناموفق بود.',
        );
        setPhase('enroll');
      });
    return () => {
      active = false;
    };
  }, [document.id]);

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.length !== 6) {
      setMessage('کد شش‌رقمی Authenticator را کامل وارد کنید.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const response = await documentsApi.createAccessGrant(document.id, {
        code,
        purpose,
      });
      await onGranted(response.data.token);
      setCode('');
    } catch (error) {
      if (
        error instanceof DocumentsApiError &&
        error.code === 'IAM_MFA_NOT_ENROLLED'
      ) {
        setPhase('enroll');
      }
      setMessage(
        error instanceof Error ? error.message : 'اعتبارسنجی ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function beginSetup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) return setMessage('رمز عبور فعلی را وارد کنید.');
    setBusy(true);
    setMessage('');
    try {
      const response = await iamMfaApi.begin({ currentPassword: password });
      setSetup(response.data);
      setPassword('');
      setCode('');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'شروع فعال‌سازی ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmSetup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.length !== 6) return setMessage('کد شش‌رقمی را کامل وارد کنید.');
    setBusy(true);
    setMessage('');
    try {
      await iamMfaApi.confirm({ code });
      setSetup(null);
      setCode('');
      setPhase('verify');
      setMessage(
        'Authenticator فعال شد. پس از تغییر کد برنامه، کد جدید را برای نمایش سند وارد کنید.',
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'تأیید فعال‌سازی ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (phase === 'checking') {
    return (
      <div className="py-6 text-center" role="status">
        <LoaderCircle className="mx-auto size-9 animate-spin text-primary" />
        <p className="mt-2 text-sm">در حال بررسی امنیت حساب…</p>
      </div>
    );
  }

  if (phase === 'enroll' && !setup) {
    return (
      <form className="space-y-3" onSubmit={(event) => void beginSetup(event)}>
        <Alert
          description="یک‌بار Authenticator حساب را فعال کنید. برای شروع، رمز عبور فعلی لازم است."
          title="فعال‌سازی اعتبارسنجی دومرحله‌ای"
          tone="warning"
        />
        <Input
          aria-label="رمز عبور فعلی"
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="رمز عبور فعلی"
          type="password"
          value={password}
        />
        {message ? (
          <Alert description={message} title="خطا" tone="error" />
        ) : null}
        <Button className="w-full" disabled={busy} type="submit">
          <KeyRound className="size-4" />
          {busy ? 'در حال بررسی…' : 'شروع فعال‌سازی امن'}
        </Button>
      </form>
    );
  }

  if (phase === 'enroll' && setup) {
    return (
      <form
        className="space-y-3"
        onSubmit={(event) => void confirmSetup(event)}
      >
        <Alert
          description="لینک را با برنامه Authenticator باز کنید یا کلید زیر را دستی وارد کنید؛ سپس کد برنامه را ثبت کنید."
          title="اتصال Authenticator"
          tone="info"
        />
        <a
          className="block rounded-xl bg-primary px-4 py-3 text-center text-sm font-bold text-primary-foreground"
          href={setup.otpAuthUri}
        >
          بازکردن در Authenticator
        </a>
        <Input
          aria-label="کلید دستی Authenticator"
          className="text-center font-mono tracking-widest"
          dir="ltr"
          readOnly
          value={setup.manualKey}
        />
        <Input
          aria-label="کد فعال‌سازی شش‌رقمی"
          autoComplete="one-time-code"
          className="text-center text-lg tracking-[0.35em]"
          dir="ltr"
          inputMode="numeric"
          onChange={(event) => setCode(normalizeCode(event.target.value))}
          placeholder="000000"
          value={code}
        />
        {message ? (
          <Alert description={message} title="خطا" tone="error" />
        ) : null}
        <Button className="w-full" disabled={busy} type="submit">
          <ShieldCheck className="size-4" />
          {busy ? 'در حال تأیید…' : 'تأیید و فعال‌سازی'}
        </Button>
      </form>
    );
  }

  return (
    <form className="space-y-3" onSubmit={(event) => void verifyCode(event)}>
      <Alert
        description={`برای ${purpose === 'PREVIEW' ? 'نمایش' : 'دانلود'} «${document.title}» کد فعلی Authenticator را وارد کنید. مجوز فقط یک‌بار و حداکثر دو دقیقه معتبر است.`}
        title="تأیید دومرحله‌ای سند"
        tone="info"
      />
      <Input
        aria-label="کد شش‌رقمی Authenticator"
        autoComplete="one-time-code"
        autoFocus
        className="text-center text-xl tracking-[0.4em]"
        dir="ltr"
        inputMode="numeric"
        maxLength={6}
        onChange={(event) => setCode(normalizeCode(event.target.value))}
        placeholder="000000"
        value={code}
      />
      {message ? (
        <Alert
          description={message}
          title={message.includes('فعال شد') ? 'فعال شد' : 'اعتبارسنجی ناموفق'}
          tone={message.includes('فعال شد') ? 'info' : 'error'}
        />
      ) : null}
      <Button
        className="w-full"
        disabled={busy || code.length !== 6}
        type="submit"
      >
        <ShieldCheck className="size-4" />
        {busy ? 'در حال اعتبارسنجی…' : 'دریافت مجوز یک‌بارمصرف'}
      </Button>
    </form>
  );
}
