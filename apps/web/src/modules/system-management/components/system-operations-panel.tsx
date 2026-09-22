'use client';

import type {
  SystemBackupRequestV1,
  SystemFeatureFlagV1,
  SystemNumberingSchemeV1,
  SystemSettingV1,
} from '@nora/contracts';
import {
  Activity,
  Database,
  Flag,
  History,
  ListOrdered,
  Send,
  Settings2,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { FormField, Input, Textarea } from '@/components/ui/form-controls';
import { Alert, Badge, Card, Skeleton } from '@/components/ui/surfaces';
import {
  systemManagementApi,
  SystemManagementApiError,
  type SystemAuditRecord,
  type SystemOverview,
} from '../api/client';

interface Data {
  audit: SystemAuditRecord[];
  backups: SystemBackupRequestV1[];
  featureFlags: SystemFeatureFlagV1[];
  health: SystemOverview['health'];
  numbering: SystemNumberingSchemeV1[];
  sessions: Awaited<ReturnType<typeof systemManagementApi.sessions>>;
  settings: SystemSettingV1[];
  overview: SystemOverview;
}

function message(error: unknown) {
  if (error instanceof SystemManagementApiError) {
    if (error.status === 401) return 'برای ادامه باید وارد سامانه شوید.';
    if (error.status === 403) return 'مجوز این بخش را ندارید.';
    if (error.status === 409)
      return 'داده هم‌زمان تغییر کرده است؛ صفحه را تازه‌سازی کنید.';
    return error.message;
  }
  return 'ارتباط با مدیریت سامانه برقرار نشد.';
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '—' : date.toLocaleString('fa-IR');
}

function metric(value: number) {
  return value.toLocaleString('fa-IR');
}

export function SystemOperationsPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [
        overview,
        settings,
        numbering,
        sessions,
        featureFlags,
        backups,
        health,
        audit,
      ] = await Promise.all([
        systemManagementApi.overview(),
        systemManagementApi.settings(),
        systemManagementApi.numberingSchemes(),
        systemManagementApi.sessions(),
        systemManagementApi.featureFlags(),
        systemManagementApi.backupRequests(),
        systemManagementApi.health(),
        systemManagementApi.audit(),
      ]);
      setData({
        audit,
        backups,
        featureFlags,
        health,
        numbering,
        overview,
        sessions,
        settings,
      });
    } catch (cause) {
      setError(message(cause));
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const submit = async (key: string, action: () => Promise<unknown>) => {
    setSaving(key);
    setError(null);
    try {
      await action();
      await load();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setSaving(null);
    }
  };

  if (!data && !error) {
    return <Skeleton className="h-96" />;
  }

  if (!data) {
    return (
      <Alert
        description={error ?? 'داده‌ای برای نمایش نیست.'}
        title="مدیریت سامانه در دسترس نیست"
        tone="error"
      >
        <Button className="mt-3" onClick={() => void load()} type="button">
          تلاش دوباره
        </Button>
      </Alert>
    );
  }

  const onSetting = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const valueType = String(form.get('valueType')) as
      'BOOLEAN' | 'JSON' | 'NUMBER' | 'STRING';
    const rawValue = String(form.get('value'));
    let value: unknown = rawValue;
    if (valueType === 'BOOLEAN') value = rawValue === 'true';
    if (valueType === 'NUMBER') value = Number(rawValue);
    if (valueType === 'JSON') {
      try {
        value = JSON.parse(rawValue) as unknown;
      } catch {
        setError('مقدار JSON معتبر نیست.');
        return;
      }
    }
    void submit('setting', () =>
      systemManagementApi.writeSetting({
        key: String(form.get('key')),
        namespace: String(form.get('namespace')),
        reason: `ویرایش تنظیم عمومی ${String(form.get('namespace'))}.${String(form.get('key'))}`,
        scope: 'GLOBAL',
        value,
        valueType,
      }),
    );
  };

  const onNumbering = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void submit('numbering', () =>
      systemManagementApi.writeNumberingScheme({
        calendar: 'JALALI',
        code: String(form.get('code')),
        includeBranch: false,
        includeFiscalYear: true,
        includeLegalEntity: false,
        isActive: true,
        padding: Number(form.get('padding')),
        prefix: String(form.get('prefix')),
        reason: `ویرایش طرح شماره‌گذاری ${String(form.get('code'))}`,
        resetPolicy: 'YEARLY',
        scope: 'GLOBAL',
        scopeId: null,
      }),
    );
  };

  const onFlag = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void submit('flag', () =>
      systemManagementApi.writeFeatureFlag({
        description: String(form.get('description')) || null,
        enabled: form.get('enabled') === 'on',
        key: String(form.get('key')),
        reason: `ویرایش Feature Flag ${String(form.get('key'))}`,
        rolloutPercent: Number(form.get('rolloutPercent') || 100),
        scope: 'GLOBAL',
        title: String(form.get('title')),
      }),
    );
  };

  const onBackup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void submit('backup', () =>
      systemManagementApi.requestBackup({
        reason: String(form.get('reason')),
        type: String(form.get('type')) as 'DATABASE' | 'FILES' | 'FULL',
      }),
    );
  };

  const onSession = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const sessionId = String(form.get('sessionId'));
    void submit('session', () =>
      systemManagementApi.revokeSession(sessionId, {
        confirmCurrentSession: form.get('confirmCurrentSession') === 'on',
        reason: String(form.get('reason')),
      }),
    );
  };

  const onRetryReportingExport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void submit('retry-reporting-export', () =>
      systemManagementApi.retryReportingExport(String(form.get('exportId')), {
        reason: String(form.get('reason')),
      }),
    );
  };

  return (
    <section aria-labelledby="system-live-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-black" id="system-live-title">
            عملیات مدیریت سامانه
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            داده و عملیات این بخش مستقیماً از API نسخه‌دار مدیریت سامانه دریافت
            می‌شود.
          </p>
        </div>
        <Button onClick={() => void load()} type="button" variant="outline">
          تازه‌سازی داده‌های عملیاتی
        </Button>
      </div>

      {error ? (
        <Alert description={error} title="عملیات ناموفق بود" tone="error" />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['تنظیم فعال', metric(data.overview.settings), Settings2],
          ['طرح شماره‌گذاری', metric(data.numbering.length), ListOrdered],
          ['نشست‌های قابل مشاهده', metric(data.sessions.length), UsersRound],
          ['Feature Flag فعال', metric(data.overview.featureFlags), Flag],
          [
            'درخواست Backup در انتظار',
            metric(data.overview.pendingBackupRequests),
            Database,
          ],
          [
            'عملیات مدیریتی ناموفق',
            metric(data.overview.failedAdminOperations),
            ShieldCheck,
          ],
          ['رخدادهای Audit', metric(data.audit.length), History],
          ['اجزای سلامت', metric(data.health.length), Activity],
        ].map(([label, value, Icon]) => {
          const MetricIcon = Icon as typeof Activity;
          return (
            <Card className="p-4" key={String(label)}>
              <MetricIcon aria-hidden="true" className="size-5 text-primary" />
              <p className="mt-3 text-2xl font-black">{String(value)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {String(label)}
              </p>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-4">
          <h3 className="font-black">تنظیم عمومی نسخه‌دار</h3>
          <form className="mt-4 grid gap-3" onSubmit={onSetting}>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Namespace" required>
                <Input defaultValue="ui" name="namespace" required />
              </FormField>
              <FormField label="کلید" required>
                <Input defaultValue="default.language" name="key" required />
              </FormField>
              <FormField label="نوع">
                <select
                  className="h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm"
                  defaultValue="STRING"
                  name="valueType"
                >
                  <option>STRING</option>
                  <option>NUMBER</option>
                  <option>BOOLEAN</option>
                  <option>JSON</option>
                </select>
              </FormField>
              <FormField label="مقدار" required>
                <Input defaultValue="fa" name="value" required />
              </FormField>
            </div>
            <Button disabled={saving === 'setting'} type="submit">
              ثبت نسخه جدید تنظیم
            </Button>
          </form>
        </Card>

        <Card className="p-4">
          <h3 className="font-black">طرح شماره‌گذاری</h3>
          <form className="mt-4 grid gap-3" onSubmit={onNumbering}>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="کد طرح" required>
                <Input name="code" placeholder="sales-contract" required />
              </FormField>
              <FormField label="پیشوند" required>
                <Input name="prefix" placeholder="SC" required />
              </FormField>
              <FormField label="Padding" required>
                <Input
                  defaultValue="6"
                  min="1"
                  max="16"
                  name="padding"
                  type="number"
                  required
                />
              </FormField>
            </div>
            <Button disabled={saving === 'numbering'} type="submit">
              ذخیره طرح شماره‌گذاری
            </Button>
          </form>
        </Card>

        <Card className="p-4">
          <h3 className="font-black">Feature Flag</h3>
          <form className="mt-4 grid gap-3" onSubmit={onFlag}>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="کلید" required>
                <Input name="key" placeholder="new-workflow" required />
              </FormField>
              <FormField label="عنوان" required>
                <Input name="title" required />
              </FormField>
              <FormField label="درصد Rollout">
                <Input
                  defaultValue="100"
                  max="100"
                  min="0"
                  name="rolloutPercent"
                  type="number"
                />
              </FormField>
            </div>
            <FormField label="توضیح">
              <Textarea name="description" />
            </FormField>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input defaultChecked name="enabled" type="checkbox" /> فعال
            </label>
            <Button disabled={saving === 'flag'} type="submit">
              ثبت Feature Flag
            </Button>
          </form>
        </Card>

        <Card className="p-4">
          <h3 className="font-black">درخواست پشتیبان</h3>
          <form className="mt-4 grid gap-3" onSubmit={onBackup}>
            <FormField label="نوع Backup">
              <select
                className="h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm"
                defaultValue="DATABASE"
                name="type"
              >
                <option>DATABASE</option>
                <option>FILES</option>
                <option>FULL</option>
              </select>
            </FormField>
            <FormField label="دلیل درخواست" required>
              <Textarea name="reason" required />
            </FormField>
            <Button disabled={saving === 'backup'} type="submit">
              ثبت درخواست امن Backup
            </Button>
          </form>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            این فرم فقط درخواست ثبت می‌کند؛ Restore یا دانلود مستقیم ندارد.
          </p>
        </Card>

        <Card className="p-4">
          <h3 className="font-black">تلاش مجدد خروجی گزارش</h3>
          <form className="mt-4 grid gap-3" onSubmit={onRetryReportingExport}>
            <FormField label="شناسه خروجی ناموفق" required>
              <Input name="exportId" placeholder="UUID خروجی گزارش" required />
            </FormField>
            <FormField label="دلیل تلاش مجدد" required>
              <Textarea name="reason" required />
            </FormField>
            <Button
              disabled={saving === 'retry-reporting-export'}
              type="submit"
            >
              <Send aria-hidden="true" className="size-4" />
              تلاش مجدد واقعی Job
            </Button>
          </form>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            فقط Export ناموفق یا منقضی Reporting، با مجوز خود Reporting و
            <bdi dir="ltr"> system.jobs.retry </bdi>، دوباره اجرا می‌شود.
          </p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="p-4">
          <h3 className="font-black">سلامت و رخدادهای اخیر</h3>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {data.health.map((item) => (
              <div className="rounded-xl bg-muted/60 p-3" key={item.component}>
                <div className="flex items-center justify-between gap-2">
                  <strong>{item.component}</strong>
                  <Badge>{item.status}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
          <ol className="mt-4 space-y-2">
            {data.audit.slice(0, 6).map((item) => (
              <li
                className="flex items-center justify-between gap-3 border-b border-border pb-2 text-xs last:border-0"
                key={item.id}
              >
                <span className="min-w-0 break-words">{item.action}</span>
                <span className="shrink-0 text-muted-foreground">
                  {formatDate(item.createdAt)}
                </span>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="p-4">
          <h3 className="font-black">پایان نشست</h3>
          <form className="mt-4 grid gap-3" onSubmit={onSession}>
            <FormField label="نشست">
              <select
                className="h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm"
                name="sessionId"
                required
              >
                {data.sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.user.displayName} —{' '}
                    {session.ipAddressMasked ?? 'IP ماسک‌شده'}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="دلیل" required>
              <Textarea name="reason" required />
            </FormField>
            <label className="flex items-start gap-2 text-xs leading-5">
              <input name="confirmCurrentSession" type="checkbox" /> اگر نشست
              جاری انتخاب شده، بستن آن را آگاهانه تأیید می‌کنم.
            </label>
            <Button
              disabled={!data.sessions.length || saving === 'session'}
              type="submit"
            >
              <Send aria-hidden="true" className="size-4" /> پایان نشست
              انتخاب‌شده
            </Button>
          </form>
        </Card>
      </div>
    </section>
  );
}
