'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  IntegrationSystemConfigV1,
  SiteConnectionStatusV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/form-controls';
import { Alert, Badge, Card } from '@/components/ui/surfaces';
import { siteConnectionApi } from '../api/client';

export function JahanBastanConnection({
  branchId,
  system,
  onSaved,
}: {
  branchId: string;
  system: IntegrationSystemConfigV1;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<SiteConnectionStatusV1 | null>(null);
  const [bundle, setBundle] = useState('');
  const [manual, setManual] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({
    origin: system.setup?.websiteUrl ?? '',
    environment: 'production',
    noraOrigin: '',
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const [revision, setRevision] = useState(0);
  const [confirm, setConfirm] = useState<'disconnect' | 'delete' | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void siteConnectionApi
      .status(branchId, system.id, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setStatus(value);
          setError('');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('دریافت تنظیمات اتصال انجام نشد.');
      });
    return () => controller.abort();
  }, [branchId, system.id, revision]);
  async function perform(job: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    setVerified(false);
    try {
      await job();
    } catch (cause) {
      if (active.current)
        setError(
          cause instanceof Error ? cause.message : 'عملیات اتصال انجام نشد.',
        );
    } finally {
      if (active.current) setBusy(false);
    }
  }
  async function save() {
    const input = manual
      ? JSON.stringify({
          ...fields,
          contract: 'jahan-bastan.nora.v1',
          siteId: 'jahan-bastan',
          apiBase: '/api/v1/integration/nora/v1',
          resources: (fields.resources ?? '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
          state: 'ACTIVE',
          version: Number(fields.version ?? '1'),
        })
      : bundle;
    const saved = await siteConnectionApi.bundle(
      branchId,
      system.id,
      input,
      status?.version ?? 0,
    );
    if (!active.current) return;
    setStatus(saved);
    setBundle('');
    setFields({});
    setMessage(
      'اطلاعات اتصال رمز‌شده ذخیره شد؛ اکنون آزمون اتصال را اجرا کنید.',
    );
    onSaved();
  }
  return (
    <Card className="grid gap-4 p-5">
      <h2 className="text-lg font-bold">اتصال جهان باستان به نورا</h2>
      <p className="text-sm leading-7 text-muted-foreground">
        بسته را از تنظیمات جهان باستان، بخش اتصال به نورا دریافت کنید. محدودیت
        کاربران از مدیریت دسترسی نورا اعمال می‌شود.
      </p>
      {status?.protocol ? (
        <Badge>
          {verified
            ? 'اتصال API تأیید شد'
            : status.lifecycle === 'ACTIVE'
              ? 'اطلاعات اتصال ثبت شده؛ نیازمند آزمون'
              : 'اتصال قطع شده است'}
        </Badge>
      ) : null}
      {status?.expiresAt ? (
        <p className="text-sm">
          انقضای کلید: {new Date(status.expiresAt).toLocaleDateString()} · تمدید
          خودکار:{' '}
          {status.renewalState === 'pending'
            ? 'در حال بازیابی'
            : status.renewalState === 'expired'
              ? 'نیازمند اتصال مجدد'
              : 'فعال'}
        </p>
      ) : null}
      {status?.remoteControlPending ? (
        <Alert title="درخواست قطع ذخیره شد و تأیید سایت در انتظار بازیابی ارتباط است." />
      ) : null}
      {error ? (
        <Alert
          title="عملیات اتصال انجام نشد"
          description={error}
          tone="error"
        />
      ) : null}
      {message ? <p role="status">{message}</p> : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void perform(save);
        }}
      >
        <fieldset
          className="grid gap-4"
          disabled={busy || !status?.canManage || !status.storageReady}
        >
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={manual}
              onChange={(event) => {
                setManual(event.target.checked);
                setBundle('');
                setFields(
                  event.target.checked
                    ? {
                        origin: system.setup?.websiteUrl ?? '',
                        noraOrigin: window.location.origin,
                        environment: 'production',
                        version: '1',
                        resources:
                          'countries,destinations,tours,hotels,service-offers,editorial-content,exchange-rates,site-analytics,customer-accounts,customer-orders',
                      }
                    : {},
                );
              }}
            />
            ورود دستی اطلاعات بسته
          </label>
          {manual ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['origin', 'نشانی HTTPS سایت'],
                ['noraOrigin', 'نشانی نورا در بسته'],
                ['organizationId', 'شناسه سازمان سایت'],
                ['environment', 'محیط اتصال'],
                ['connectionId', 'شناسه اتصال'],
                ['expiresAt', 'زمان انقضای بسته'],
                ['version', 'نسخه اتصال در سایت'],
                ['resources', 'منابع مجاز بسته با جداکننده کاما'],
                ['apiKey', 'کلید Bearer'],
                ['signingKey', 'کلید امضای HMAC'],
              ].map(([key, label]) => (
                <label className="grid gap-2" key={key}>
                  {label}
                  <Input
                    dir="ltr"
                    required
                    autoComplete="off"
                    type={key!.endsWith('Key') ? 'password' : 'text'}
                    value={fields[key!] ?? ''}
                    onChange={(event) =>
                      setFields({ ...fields, [key!]: event.target.value })
                    }
                  />
                </label>
              ))}
            </div>
          ) : (
            <label className="grid gap-2">
              بسته اتصال جهان باستان
              <Textarea
                dir="ltr"
                autoComplete="off"
                maxLength={16000}
                value={bundle}
                onChange={(event) => setBundle(event.target.value)}
              />
            </label>
          )}
          <Button type="submit" disabled={!manual && !bundle.trim()}>
            ذخیره امن اطلاعات اتصال
          </Button>
        </fieldset>
      </form>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          disabled={
            busy ||
            status?.protocol !== 'jahan-bastan.nora.v1' ||
            status.lifecycle !== 'ACTIVE' ||
            !!bundle
          }
          onClick={() =>
            void perform(async () => {
              const result = await siteConnectionApi.test(branchId, system.id);
              if (result.state !== 'CONNECTED')
                throw new Error('اتصال تأیید نشد.');
              if (active.current) {
                setVerified(true);
                setMessage('هویت سایت، کاربر، شعبه و پاسخ واقعی API تأیید شد.');
                onSaved();
              }
            })
          }
        >
          آزمون اتصال همین سایت
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            setVerified(false);
            setBundle('');
            setFields({});
            setRevision((n) => n + 1);
          }}
        >
          بارگذاری تنظیمات ذخیره‌شده
        </Button>
        {status?.canManage && status.protocol === 'jahan-bastan.nora.v1' ? (
          <>
            <Button
              variant="outline"
              disabled={busy || status.lifecycle !== 'ACTIVE'}
              onClick={() => setConfirm('disconnect')}
            >
              قطع اتصال
            </Button>
            <Button
              variant="outline"
              disabled={busy || status.lifecycle === 'DELETED'}
              onClick={() => setConfirm('delete')}
            >
              حذف اتصال
            </Button>
          </>
        ) : null}
      </div>
      {confirm ? (
        <div
          role="alertdialog"
          aria-label="تأیید قطع یا حذف اتصال"
          className="grid gap-3 rounded-xl border p-4"
        >
          <p>
            کلیدها و دسترسی‌های این اتصال باطل می‌شوند؛ اطلاعات تجاری و تاریخچه
            حسابرسی حفظ می‌شوند.
          </p>
          <Button
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                const saved = await siteConnectionApi.lifecycle(
                  branchId,
                  system.id,
                  confirm,
                  crypto.randomUUID(),
                  status!.version,
                );
                if (active.current) {
                  setStatus(saved);
                  setConfirm(null);
                  onSaved();
                }
              })
            }
          >
            تأیید قطع دسترسی
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setConfirm(null)}
          >
            انصراف
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
