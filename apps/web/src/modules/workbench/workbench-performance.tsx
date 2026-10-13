'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type {
  WorkbenchPerformanceResponseV1,
  WorkbenchHrPerformanceRecordV1,
  WorkbenchMonthlySalesPeriodV1,
  WorkbenchSalesPerformanceV1,
} from '@nora/contracts';
import {
  CalendarDays,
  ChartNoAxesCombined,
  RefreshCw,
  Wallet,
  UsersRound,
  LogIn,
  LogOut,
  BriefcaseBusiness,
} from 'lucide-react';
import { Alert, Badge, Button, Card, Skeleton } from '@/components/ui';
import { workbenchPersonalApi } from './workbench-personal-api';
import { WorkbenchSelect } from './workbench-select';
import { workbenchDate } from './model';

const number = (value: number | undefined) =>
  value === undefined ? '—' : value.toLocaleString('fa-IR');
const field = (
  record: WorkbenchHrPerformanceRecordV1 | null | undefined,
  label: string,
) => record?.fields.find((item) => item.label === label)?.value;
function date(value: string | undefined) {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value))
    return new Date(`${value}T12:00:00Z`).toLocaleDateString('fa-IR');
  return value;
}
export function WorkbenchPerformance() {
  const [days, setDays] = useState('30');
  const [version, setVersion] = useState(0);
  const [data, setData] = useState<WorkbenchPerformanceResponseV1 | null>(null);
  const [error, setError] = useState('');
  const [chartCurrency, setChartCurrency] = useState('');
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
  const hr = data?.hr.status === 'ready' ? data.hr.data : null;
  const sales = data?.sales.status === 'ready' ? data.sales.data : null;
  const linked = Boolean(hr?.employee);
  const attendance = hr?.todayAttendance;
  const payslip = hr?.latestPayslip;
  const hrHint = linked ? 'از منابع انسانی' : 'نیازمند اتصال پرونده پرسنلی';
  return (
    <section className="space-y-5" aria-label="عملکرد من">
      <Card className="overflow-hidden border-primary/20">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-l from-primary/15 via-sky-500/10 to-violet-500/10 p-6">
          <div className="flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <ChartNoAxesCombined aria-hidden="true" className="size-7" />
            </span>
            <div>
              <h2 className="text-2xl font-black">عملکرد من</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                حضور امروز، برنامه کاری و دستاوردهای شما
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <WorkbenchSelect
              label="بازه آمار فروش و مشتریان"
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
        </div>
        {data && (
          <div className="flex flex-wrap justify-between gap-2 px-6 py-3 text-xs text-muted-foreground">
            <span>
              {hr?.employee
                ? `${hr.employee.name} · ${hr.employee.position} · ${hr.employee.unit}`
                : 'خلاصه حساب شخصی شما'}
            </span>
            <span>آخرین دریافت: {workbenchDate(data.generatedAt)}</span>
          </div>
        )}
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
          {data.hr.status !== 'ready' ? (
            <Alert
              title="منابع انسانی"
              description={data.hr.message}
              tone={data.hr.status === 'error' ? 'error' : 'info'}
            />
          ) : (
            !linked && (
              <Alert
                title="اتصال پرونده پرسنلی"
                description="برای نمایش مرخصی، شیفت، تردد و حقوق، منابع انسانی باید حساب CRM شما را به پرونده پرسنلی‌تان متصل کند."
              />
            )
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="تعداد مرخصی‌ها"
              value={number(linked ? hr?.approvedLeaveCount : undefined)}
              hint={linked ? 'درخواست تأییدشده · همه دوره‌ها' : hrHint}
              icon={<CalendarDays />}
              tone="border-emerald-500/20 bg-emerald-500/10"
            />
            <Metric
              label="دریافتی ماه"
              value={
                linked && hr?.payslipVisible
                  ? (field(payslip, 'خالص پرداختی') ?? '—')
                  : '—'
              }
              hint={
                payslip
                  ? `خالص فیش تأییدشده · ${field(payslip, 'دوره') ?? 'دوره نامشخص'} · ${field(payslip, 'ارز') ?? ''}`
                  : linked
                    ? hr?.payslipVisible
                      ? 'فیش تأییدشده‌ای ثبت نشده'
                      : 'نیازمند مجوز مشاهده فیش'
                    : hrHint
              }
              icon={<Wallet />}
              tone="border-violet-500/20 bg-violet-500/10"
            />
            <Metric
              label="تعداد مشتری‌ها"
              value={number(sales?.customers)}
              hint={
                sales
                  ? 'مشتریان یکتای فروش‌های تأییدشده در بازه'
                  : 'آمار در دسترس این حساب نیست'
              }
              icon={<UsersRound />}
              tone="border-sky-500/20 bg-sky-500/10"
            />
            <Metric
              label="تعداد فروش‌ها"
              value={number(sales?.confirmedContracts)}
              hint={
                sales
                  ? 'قرارداد تأییدشده در بازه انتخابی'
                  : 'آمار در دسترس این حساب نیست'
              }
              icon={<ChartNoAxesCombined />}
              tone="border-amber-500/20 bg-amber-500/10"
            />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="space-y-5 p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold">ورود و خروج امروز</h3>
                <Badge>{date(attendance?.date)}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Metric
                  label="اولین ورود"
                  value={attendance?.firstIn ?? '—'}
                  hint={linked ? 'ساعت تهران' : hrHint}
                  icon={<LogIn />}
                  tone="border-emerald-500/20 bg-emerald-500/5"
                />
                <Metric
                  label="آخرین خروج"
                  value={attendance?.lastOut ?? '—'}
                  hint={linked ? 'ساعت تهران' : hrHint}
                  icon={<LogOut />}
                  tone="border-orange-500/20 bg-orange-500/5"
                />
              </div>
              {linked && !attendance?.firstIn && !attendance?.lastOut && (
                <p className="text-sm text-muted-foreground">
                  ترددی برای امروز ثبت نشده است.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                ترددهای روز تقویمی امروز، با اعمال اصلاحات تأییدشده منابع انسانی
              </p>
            </Card>
            <Card className="space-y-4 p-6">
              <h3 className="flex items-center gap-2 text-lg font-bold">
                <BriefcaseBusiness
                  className="size-5 text-primary"
                  aria-hidden="true"
                />
                تاریخ شیفت‌های من
              </h3>
              {hr?.shifts.length ? (
                <div className="max-h-72 space-y-3 overflow-y-auto">
                  {hr.shifts.map((shift) => (
                    <div
                      key={shift.id}
                      className="rounded-xl border border-primary/15 bg-primary/5 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong>
                          {field(shift, 'عنوان شیفت') ??
                            field(shift, 'شیفت') ??
                            'برنامه کاری'}
                        </strong>
                        <Badge>{shift.status}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                        {shift.fields
                          .filter((item) =>
                            /تاریخ|هفته|شنبه|ساعت شروع|ساعت پایان/.test(
                              item.label,
                            ),
                          )
                          .map((item) => (
                            <span key={item.label}>
                              <span className="text-muted-foreground">
                                {item.label}:{' '}
                              </span>
                              {date(item.value)}
                            </span>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  {linked ? 'هنوز برنامه شیفتی ثبت نشده است.' : hrHint}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                ۱۰ برنامه اخیر ثبت‌شده در منابع انسانی
              </p>
            </Card>
          </div>
          {!!hr?.leaveBalances.length && (
            <Card className="space-y-4 p-6">
              <h3 className="text-lg font-bold">مانده مرخصی</h3>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {hr.leaveBalances.map((balance) => (
                  <div
                    key={balance.type}
                    className="rounded-xl bg-emerald-500/5 p-4"
                  >
                    <span className="text-sm">{balance.type}</span>
                    <strong className="mt-2 block text-xl">
                      {balance.balance} روز
                    </strong>
                    <p className="mt-2 text-xs text-muted-foreground">
                      مصرف‌شده: {balance.used} روز · سهمیه: {balance.granted}{' '}
                      روز
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                دفتر مرخصی سال {number(hr.leaveYear ?? undefined)} میلادی
              </p>
            </Card>
          )}
          {data.sales.status === 'error' && (
            <Alert
              tone="error"
              title="آمار فروش دریافت نشد"
              description={data.sales.message}
            />
          )}
          {sales && (
            <MonthlySales
              sales={sales.monthly}
              currency={chartCurrency}
              onCurrencyChange={setChartCurrency}
            />
          )}
          {sales && (
            <Card className="space-y-4 p-6">
              <h3 className="text-lg font-bold">فروش در بازه انتخابی</h3>
              <div className="flex flex-wrap gap-3">
                {sales.amounts.length ? (
                  sales.amounts.map((amount) => (
                    <div
                      key={amount.currencyCode}
                      className="min-w-40 rounded-xl bg-primary/5 p-4"
                    >
                      <span className="text-xs text-muted-foreground">
                        {amount.currencyCode}
                      </span>
                      <strong className="mt-2 block text-2xl" dir="ltr">
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
              <p className="text-xs text-muted-foreground">
                فقط قراردادهای متعلق به شما که در بازه انتخابی ایجاد و تأیید
                شده‌اند؛ پیش‌نویس و لغوشده محاسبه نمی‌شود.
              </p>
              {sales.partial && (
                <Alert
                  title="آمار محدود"
                  description="سقف ۱۰۰۰ قرارداد دریافت شده است؛ برای آمار کامل بازه کوتاه‌تری انتخاب کنید."
                />
              )}
            </Card>
          )}
        </>
      )}
    </section>
  );
}

function money(amount: string) {
  const [whole, fraction] = amount.split('.');
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  return `${grouped}${fraction ? `٫${fraction}` : ''}`.replace(
    /\d/g,
    (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]!,
  );
}

function dailySeries(period: WorkbenchMonthlySalesPeriodV1, currency: string) {
  let cumulative = 0;
  return period.daily.map((day) => {
    cumulative += Number(
      day.amounts.find((item) => item.currencyCode === currency)?.amount ?? 0,
    );
    return cumulative;
  });
}

function MonthlySales({
  sales,
  currency,
  onCurrencyChange,
}: {
  sales: WorkbenchSalesPerformanceV1['monthly'];
  currency: string;
  onCurrencyChange: (value: string) => void;
}) {
  if (!sales) return null;
  const currencies = [
    ...new Set([
      ...sales.current.amounts.map((item) => item.currencyCode),
      ...sales.previous.amounts.map((item) => item.currencyCode),
    ]),
  ].sort();
  const selected = currencies.includes(currency)
    ? currency
    : (currencies[0] ?? '');
  const currentAmount =
    sales.current.amounts.find((item) => item.currencyCode === selected)
      ?.amount ?? '0';
  const previousAmount =
    sales.previous.amounts.find((item) => item.currencyCode === selected)
      ?.amount ?? '0';
  const previousElapsed =
    sales.previous.throughElapsedDay.find(
      (item) => item.currencyCode === selected,
    )?.amount ?? '0';
  const currentElapsed =
    sales.current.throughElapsedDay.find(
      (item) => item.currencyCode === selected,
    )?.amount ?? '0';
  const currentSeries = dailySeries(sales.current, selected).slice(
    0,
    sales.elapsedDay,
  );
  const previousSeries = dailySeries(sales.previous, selected).slice(
    0,
    sales.elapsedDay,
  );
  const peak = Math.max(1, ...currentSeries, ...previousSeries);
  const points = (values: number[]) =>
    values
      .map((value, index) => `${12 + index * 16},${116 - (value / peak) * 96}`)
      .join(' ');
  const previousNumber = Number(previousElapsed);
  const change = previousNumber
    ? ((Number(currentElapsed) - previousNumber) / previousNumber) * 100
    : null;
  return (
    <Card className="space-y-5 p-5 sm:p-6" aria-label="فروش ماه شمسی من">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">فروش ماه شمسی من</h3>
          <p className="text-xs text-muted-foreground">
            {sales.currentLabel} در مقایسه با {sales.previousLabel}؛ فقط
            قراردادهای تأییدشده متعلق به شما
          </p>
        </div>
        {currencies.length > 1 && (
          <WorkbenchSelect
            label="ارز نمودار فروش"
            value={selected}
            onValueChange={onCurrencyChange}
            options={currencies.map((value) => ({ value, label: value }))}
          />
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="رقم کل فروش ماه"
          value={
            sales.current.amounts.length
              ? sales.current.amounts
                  .map((item) => `${money(item.amount)} ${item.currencyCode}`)
                  .join(' · ')
              : '۰'
          }
          hint={sales.currentLabel}
          icon={<Wallet />}
          tone="border-blue-500/20 bg-blue-500/5"
        />
        <Metric
          label="قراردادهای فروش ماه"
          value={number(sales.current.contracts)}
          hint={`ماه قبل: ${number(sales.previous.contracts)}`}
          icon={<ChartNoAxesCombined />}
          tone="border-amber-500/20 bg-amber-500/5"
        />
        <Metric
          label="نفرات فروخته‌شده"
          value={number(sales.current.people)}
          hint={`ماه قبل: ${number(sales.previous.people)}`}
          icon={<UsersRound />}
          tone="border-emerald-500/20 bg-emerald-500/5"
        />
        <Metric
          label="تغییر فروش تا روز مشابه"
          value={
            change === null
              ? '—'
              : `${change >= 0 ? '+' : ''}${change.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}٪`
          }
          hint={
            selected
              ? `${selected} · تا روز ${number(sales.elapsedDay)} هر ماه`
              : 'بدون فروش ثبت‌شده'
          }
          icon={<ChartNoAxesCombined />}
          tone={
            change !== null && change < 0
              ? 'border-rose-500/20 bg-rose-500/5'
              : 'border-violet-500/20 bg-violet-500/5'
          }
        />
      </div>
      {selected && (
        <div className="rounded-2xl border border-border p-4">
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <strong>روند تجمعی فروش ({selected})</strong>
            <span className="text-muted-foreground">
              ماه جاری: {money(currentAmount)} · ماه قبل:{' '}
              {money(previousAmount)}
            </span>
          </div>
          <div className="mt-2 flex gap-4 text-xs">
            <span className="text-primary">● {sales.currentLabel}</span>
            <span className="text-muted-foreground">
              ● {sales.previousLabel}
            </span>
          </div>
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${Math.max(520, sales.elapsedDay * 16 + 24)} 130`}
              className="mt-3 h-40 min-w-[520px] w-full"
              role="img"
              aria-label={`روند تجمعی ${selected} در ${sales.currentLabel} و ${sales.previousLabel} تا روز ${sales.elapsedDay}`}
            >
              <line
                x1="12"
                y1="116"
                x2={Math.max(508, sales.elapsedDay * 16 + 12)}
                y2="116"
                stroke="currentColor"
                opacity=".2"
              />
              <polyline
                points={points(previousSeries)}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="5 4"
                opacity=".5"
              />
              <polyline
                points={points(currentSeries)}
                fill="none"
                stroke="#2563eb"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="text-xs text-muted-foreground">
            مقایسه تا روز یکسان ماه انجام می‌شود؛ مجموع ماه قبل مربوط به کل آن
            ماه است.
          </p>
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[920px] text-right text-sm">
          <caption className="p-4 text-right font-bold">
            فروش به تفکیک مسیر
          </caption>
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3">مسیر</th>
              <th className="p-3">قرارداد جاری / قبل</th>
              <th className="p-3">نفرات جاری / قبل</th>
              <th className="p-3">مبلغ ماه جاری</th>
              <th className="p-3">مبلغ ماه قبل</th>
            </tr>
          </thead>
          <tbody>
            {sales.routes.length ? (
              sales.routes.map((route) => (
                <tr
                  key={`${route.originId}:${route.destinationId}`}
                  className="border-t border-border"
                >
                  <td className="p-3">{route.label}</td>
                  <td className="p-3">
                    {number(route.contracts)} /{' '}
                    {number(route.previousContracts)}
                  </td>
                  <td className="p-3">
                    {number(route.people)} / {number(route.previousPeople)}
                  </td>
                  <td className="p-3">
                    {route.amounts
                      .map(
                        (item) => `${money(item.amount)} ${item.currencyCode}`,
                      )
                      .join(' · ') || '—'}
                  </td>
                  <td className="p-3">
                    {route.previousAmounts
                      .map(
                        (item) => `${money(item.amount)} ${item.currencyCode}`,
                      )
                      .join(' · ') || '—'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="p-5 text-center text-muted-foreground"
                >
                  فروش تأییدشده‌ای در این دو ماه ثبت نشده است.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
function Metric({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className={`min-w-0 rounded-2xl border p-5 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        <span
          className="rounded-xl bg-surface/70 p-2 text-primary [&>svg]:size-5"
          aria-hidden="true"
        >
          {icon}
        </span>
      </div>
      <strong className="my-4 block break-words text-3xl font-black tabular-nums">
        {value}
      </strong>
      <p className="text-xs leading-6 text-muted-foreground">{hint}</p>
    </div>
  );
}
