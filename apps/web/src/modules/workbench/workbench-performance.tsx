'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  WorkbenchPerformanceResponseV1,
  WorkbenchHrPerformanceRecordV1,
} from '@rubi/contracts';
import {
  Activity,
  CalendarDays,
  ChartNoAxesCombined,
  RefreshCw,
  Wallet,
  UsersRound,
} from 'lucide-react';
import { Alert, Badge, Button, Card, Skeleton } from '@/components/ui';
import { workbenchPersonalApi } from './workbench-personal-api';
import { WorkbenchSelect } from './workbench-select';
import { workbenchDate } from './model';

const number = (value: number) => value.toLocaleString('fa-IR');
function fieldValue(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00Z`);
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString('fa-IR');
  }
  return value;
}

export function WorkbenchPerformance() {
  const [days, setDays] = useState('30');
  const [version, setVersion] = useState(0);
  const [data, setData] = useState<WorkbenchPerformanceResponseV1 | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void workbenchPersonalApi
      .performance(days)
      .then((response) => {
        if (active) {
          setData(response);
          setError('');
        }
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error ? reason.message : 'عملکرد دریافت نشد.',
          );
      });
    return () => {
      active = false;
    };
  }, [days, version]);
  function reload(value = days) {
    setData(null);
    setError('');
    setDays(value);
    setVersion((current) => current + 1);
  }
  return (
    <section className="space-y-5" aria-label="عملکرد من">
      <Card className="flex flex-wrap items-center justify-between gap-4 border-primary/20 bg-primary/5 p-5">
        <div className="flex items-center gap-3">
          <ChartNoAxesCombined
            className="size-9 text-primary"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-xl font-bold">عملکرد من</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              کارنامه شغلی و اطلاعات منابع انسانیِ حساب شما
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <WorkbenchSelect
            label="بازه آمار شغلی"
            value={days}
            onValueChange={reload}
            options={[
              { value: '30', label: '۳۰ روز اخیر' },
              { value: '90', label: '۹۰ روز اخیر' },
              { value: '365', label: '۳۶۵ روز اخیر' },
            ]}
          />
          <Button
            variant="outline"
            onClick={() => reload()}
            aria-label="به‌روزرسانی عملکرد"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </Card>
      {error ? (
        <Alert
          tone="error"
          title="دریافت عملکرد انجام نشد"
          description={error}
        />
      ) : !data ? (
        <div role="status" aria-label="دریافت عملکرد">
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            آخرین دریافت: {workbenchDate(data.generatedAt)} · اطلاعات منابع
            انسانی مستقل از بازه آمار شغلی است.
          </p>
          {data.hr.status !== 'ready' ? (
            <Alert
              title="منابع انسانی"
              description={data.hr.message}
              tone={data.hr.status === 'error' ? 'error' : 'info'}
            />
          ) : !data.hr.data.employee ? (
            <Card className="p-5">
              <h3 className="font-bold">
                پرونده پرسنلی به حساب شما متصل نشده است
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                منابع انسانی باید حساب CRM شما را در پرونده پرسنلی انتخاب کند تا
                مرخصی، شیفت و فیش حقوقی همین‌جا نمایش داده شود.
              </p>
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Badge>{data.hr.data.employee.position || 'همکار'}</Badge>
                <span className="font-semibold">
                  {data.hr.data.employee.name}
                </span>
                <span className="text-sm text-muted-foreground">
                  {data.hr.data.employee.unit} · کد پرسنلی{' '}
                  {data.hr.data.employee.personnelCode}
                </span>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <Panel
                  title="مرخصی‌های من"
                  icon={<CalendarDays />}
                  tone="bg-emerald-500/5 border-emerald-500/20"
                >
                  {!!data.hr.data.leaveBalances.length && (
                    <div className="space-y-2 border-b border-border pb-3">
                      <p className="text-xs text-muted-foreground">
                        مانده دفتر مرخصی سال{' '}
                        {number(data.hr.data.leaveYear ?? 0)} میلادی · روز
                      </p>
                      {data.hr.data.leaveBalances.map((balance) => (
                        <div
                          key={balance.type}
                          className="flex justify-between gap-2 text-sm"
                        >
                          <span>{balance.type}</span>
                          <strong>{balance.balance}</strong>
                          <span className="text-muted-foreground">
                            مصرف: {balance.used}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    ۱۰ درخواست آخر، همراه با وضعیت تأیید
                  </p>
                  <Records
                    records={data.hr.data.leaves}
                    empty="درخواست مرخصی ثبت نشده است."
                  />
                </Panel>
                <Panel
                  title="شیفت‌های من"
                  icon={<UsersRound />}
                  tone="bg-sky-500/5 border-sky-500/20"
                >
                  <p className="text-xs text-muted-foreground">
                    ۱۰ برنامه اخیر ثبت‌شده در منابع انسانی
                  </p>
                  <Records
                    records={data.hr.data.shifts}
                    empty="شیفتی به پرونده شما اختصاص داده نشده است."
                  />
                </Panel>
                <Panel
                  title="آخرین فیش حقوقی من"
                  icon={<Wallet />}
                  tone="bg-violet-500/5 border-violet-500/20"
                >
                  <p className="text-xs text-muted-foreground">
                    آخرین فیش تأییدشده؛ مبلغ فیش به‌تنهایی تأیید واریز بانکی
                    نیست.
                  </p>
                  <Records
                    records={
                      data.hr.data.latestPayslip
                        ? [data.hr.data.latestPayslip]
                        : []
                    }
                    empty={
                      data.hr.data.payslipVisible
                        ? 'فیش تأییدشده‌ای ثبت نشده است.'
                        : 'دسترسی مشاهده فیش شخصی برای حساب شما تعریف نشده است.'
                    }
                  />
                </Panel>
              </div>
            </>
          )}
          {data.sales.status === 'error' ? (
            <Alert
              tone="error"
              title="آمار فروش دریافت نشد"
              description={data.sales.message}
            />
          ) : (
            data.sales.status === 'ready' && (
              <Card className="space-y-4 p-5">
                <h3 className="text-lg font-bold">فروش و مشتریان من</h3>
                <p className="text-sm text-muted-foreground">
                  قراردادهایی که در بازه انتخابی ایجاد شده‌اند و شما مالک آن‌ها
                  هستید. مبلغ فروش و مشتریان از قراردادهای تأییدشده محاسبه
                  می‌شود؛ پیش‌نویس‌ها و لغوشده‌ها در آن‌ها محاسبه نمی‌شوند.
                </p>
                {data.sales.data.partial && (
                  <Alert
                    title="بخشی از آمار"
                    description="سقف ۱۰۰۰ قرارداد دریافت شده است؛ اعداد زیر فقط مربوط به قراردادهای دریافت‌شده‌اند. بازه کوتاه‌تری انتخاب کنید."
                  />
                )}
                <div className="grid gap-3 sm:grid-cols-3">
                  <Metric
                    label="کل قراردادهای من"
                    value={number(data.sales.data.contracts)}
                  />
                  <Metric
                    label="قراردادهای تأییدشده"
                    value={number(data.sales.data.confirmedContracts)}
                  />
                  <Metric
                    label="مشتریان یکتای قراردادهای تأییدشده"
                    value={number(data.sales.data.customers)}
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  {data.sales.data.amounts.length ? (
                    data.sales.data.amounts.map((amount) => (
                      <div
                        key={amount.currencyCode}
                        className="rounded-xl bg-primary/5 px-5 py-3"
                      >
                        <span className="block text-xs text-muted-foreground">
                          مبلغ فروش · {amount.currencyCode}
                        </span>
                        <strong className="mt-1 block text-xl" dir="ltr">
                          {amount.amount}
                        </strong>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      فروش تأییدشده‌ای در این بازه ثبت نشده است.
                    </p>
                  )}
                </div>
              </Card>
            )
          )}
          {data.activity.status !== 'ready' ? (
            <Alert
              tone="error"
              title="فعالیت شغلی دریافت نشد"
              description={data.activity.message}
            />
          ) : (
            <Card className="space-y-4 p-5">
              <h3 className="flex items-center gap-2 text-lg font-bold">
                <Activity className="size-5 text-primary" aria-hidden="true" />
                فعالیت من در بخش‌های CRM
              </h3>
              <p className="text-sm text-muted-foreground">
                فعالیت‌های شما در بازه انتخابی: حداکثر{' '}
                {number(data.activity.data.sourceLimit)} رویداد اخیر حساب، ۱۰۰
                عملیات اخیر منابع انسانی، تاریخچه وضعیت ۲۰ قرارداد شما و فعالیت
                شما در پرونده مشتریان همان قراردادها. این اعداد شمارش همین
                رویدادها هستند. بخش‌ها مطابق دسترسی فعلی شما نمایش داده می‌شوند.
              </p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {data.activity.data.modules.map((module) => (
                  <Metric
                    key={module.key}
                    label={module.label}
                    value={number(module.count)}
                  />
                ))}
              </div>
              <ul className="divide-y divide-border">
                {data.activity.data.recent.map((activity) => (
                  <li
                    key={activity.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                  >
                    <span>
                      <Badge>{activity.moduleLabel}</Badge>
                      <span className="ms-2">
                        {activityLabel(activity.action)}
                      </span>
                    </span>
                    <time
                      dateTime={activity.occurredAt}
                      className="text-xs text-muted-foreground"
                    >
                      {workbenchDate(activity.occurredAt)}
                    </time>
                  </li>
                ))}
              </ul>
              {!data.activity.data.recent.length && (
                <p className="text-sm text-muted-foreground">
                  فعالیتی در این بازه و فهرست رویدادهای اخیر ثبت نشده است.
                </p>
              )}
            </Card>
          )}
        </>
      )}
    </section>
  );
}

function Panel({
  title,
  icon,
  tone,
  children,
}: {
  title: string;
  icon: ReactNode;
  tone: string;
  children: ReactNode;
}) {
  return (
    <Card className={`space-y-3 p-5 ${tone}`}>
      <h3 className="flex items-center gap-2 font-bold">
        <span className="[&>svg]:size-5 text-primary" aria-hidden="true">
          {icon}
        </span>
        {title}
      </h3>
      {children}
    </Card>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <strong className="mt-2 block text-2xl">{value}</strong>
    </div>
  );
}
function Records({
  records,
  empty,
}: {
  records: WorkbenchHrPerformanceRecordV1[];
  empty: string;
}) {
  return records.length ? (
    <div className="max-h-96 space-y-3 overflow-y-auto">
      {records.map((record) => (
        <div
          key={record.id}
          className="space-y-2 rounded-xl border border-border bg-card p-3"
        >
          <Badge>{record.status}</Badge>
          <dl className="space-y-2">
            {record.fields.map((field, index) => (
              <div key={index} className="flex justify-between gap-3 text-sm">
                <dt className="text-muted-foreground">{field.label}</dt>
                <dd className="text-end font-medium">
                  {fieldValue(field.value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  ) : (
    <p className="py-3 text-sm text-muted-foreground">{empty}</p>
  );
}
function activityLabel(action: string) {
  const salesStatus: Record<string, string> = {
    'sales.status.draft': 'ایجاد پیش‌نویس قرارداد',
    'sales.status.pending_confirmation': 'ارسال قرارداد برای تأیید',
    'sales.status.confirmed': 'تأیید قرارداد',
    'sales.status.sent_to_reservations': 'ارسال قرارداد به رزرواسیون',
    'sales.status.in_progress': 'شروع رسیدگی به قرارداد',
    'sales.status.completed': 'تکمیل قرارداد',
    'sales.status.cancelled': 'لغو قرارداد',
  };
  if (salesStatus[action]) return salesStatus[action];
  if (/created?$/.test(action)) return 'ایجاد رکورد';
  if (/updated?$/.test(action)) return 'ویرایش اطلاعات';
  if (/deleted?$/.test(action)) return 'حذف رکورد';
  if (/export/.test(action)) return 'خروجی گزارش';
  if (/preview|read/.test(action)) return 'مشاهده اطلاعات';
  if (/confirm|approve/.test(action)) return 'تأیید';
  if (/submit|send/.test(action)) return 'ارسال برای پیگیری';
  return 'عملیات ثبت‌شده';
}
