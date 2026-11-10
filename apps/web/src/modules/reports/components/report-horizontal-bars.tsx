'use client';

import { currencySymbol } from '@/lib/currency-symbol';
import { formatReportMoney } from '../model/report-money-format';
import type { ReportChartGroup, ReportChartMetric } from '../model/chart-data';

const colors = ['#2563eb', '#14b8a6', '#8b5cf6', '#f59e0b', '#0ea5e9'];

export function ReportHorizontalBars({
  groups,
  metric,
  dimensions,
  layout = 'horizontal',
}: {
  groups: readonly ReportChartGroup[];
  metric: ReportChartMetric;
  dimensions: string;
  layout?: 'horizontal' | 'column';
}) {
  const currencies = [
    ...new Set(
      groups.flatMap((group) =>
        group.values.map((value) => value.currencyCode),
      ),
    ),
  ];
  const axes = new Map(
    currencies.map((code) => {
      const values = groups
        .flatMap((group) =>
          group.values
            .filter((v) => v.currencyCode === code)
            .map((v) => Number(v.amount)),
        )
        .filter(Number.isFinite);
      const min = Math.min(0, ...values),
        max = Math.max(0, ...values);
      return [code, { min, range: max - min || 1 }];
    }),
  );
  return (
    <figure
      dir="rtl"
      role="img"
      aria-label={`${layout === 'horizontal' ? 'نمودار میله‌ای افقی' : 'نمودار ستونی'} ${metric.label} به تفکیک ${dimensions}`}
      className="space-y-3 rounded-2xl border p-4"
    >
      <h3 className="text-sm font-bold">
        {metric.label} به تفکیک {dimensions}
      </h3>
      {metric.money ? (
        <p className="text-xs text-muted-foreground">
          مبالغ ارزها با هم جمع نمی‌شوند؛ مقیاس هر ارز مستقل است.
        </p>
      ) : null}
      {metric.money && currencies.length > 1 ? (
        <ul
          className="flex flex-wrap gap-4 text-xs"
          aria-label="راهنمای ارزهای نمودار"
        >
          {currencies.map((code, index) => (
            <li className="flex items-center gap-1.5" key={code}>
              <span
                className="size-2.5 rounded-sm"
                style={{ background: colors[index % colors.length] }}
                aria-hidden="true"
              />
              <bdi>{currencySymbol(code)}</bdi>
            </li>
          ))}
        </ul>
      ) : null}
      <div
        aria-label="داده‌های نمودار میله‌ای؛ برای مشاهده موارد بیشتر اسکرول کنید"
        tabIndex={0}
        className="max-h-[32rem] overflow-auto overflow-y-auto overscroll-contain rounded-xl border border-border/80 bg-muted/[0.12] p-3"
      >
        {layout === 'horizontal' ? (
          <div className="min-w-[36rem] space-y-3">
            {groups.map(({ row, values }) => (
              <div
                key={row.grainId}
                data-report-chart-row={row.grainId}
                className="grid grid-cols-[minmax(9rem,1fr)_minmax(12rem,2fr)_minmax(10rem,1.3fr)] items-center gap-3"
              >
                <span
                  className="min-w-0 break-words text-right text-xs font-bold"
                  title={`${row.branchId} · ${row.ownerUserId}`}
                >
                  {row.branchId} · {row.ownerUserId}
                </span>
                <div className="space-y-1.5">
                  {values.map((value) => {
                    const axis = axes.get(value.currencyCode)!;
                    const number = Number(value.amount);
                    const zero = (-axis.min / axis.range) * 100;
                    const position = ((number - axis.min) / axis.range) * 100;
                    const color =
                      colors[
                        currencies.indexOf(value.currencyCode) % colors.length
                      ];
                    return (
                      <div
                        key={value.currencyCode}
                        dir="ltr"
                        className="relative h-5 overflow-hidden rounded-md bg-slate-200/80 dark:bg-slate-700/80"
                        title={`${formatReportMoney(value.amount)} ${metric.money ? currencySymbol(value.currencyCode) : metric.label}`}
                      >
                        <span
                          className="absolute inset-y-0 border-l border-slate-500"
                          style={{ left: `${zero}%` }}
                          aria-hidden="true"
                        />
                        <span
                          className="absolute inset-y-0 rounded-md"
                          data-currency={value.currencyCode}
                          style={{
                            left: `${Math.min(zero, position)}%`,
                            width: `${Number.isFinite(number) ? Math.abs(position - zero) : 0}%`,
                            background: `linear-gradient(to right, ${color}, #17396d)`,
                          }}
                          aria-hidden="true"
                        />
                      </div>
                    );
                  })}
                </div>
                <strong
                  className="break-words text-left text-xs tabular-nums"
                  dir="ltr"
                >
                  {values.length
                    ? values.map((value, index) => (
                        <span key={value.currencyCode}>
                          {index ? ' + ' : ''}
                          <bdi dir="ltr">
                            {formatReportMoney(value.amount)}
                            {metric.money ? (
                              <>
                                {' '}
                                <bdi>{currencySymbol(value.currencyCode)}</bdi>
                              </>
                            ) : null}
                          </bdi>
                        </span>
                      ))
                    : '—'}
                </strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex min-w-max items-end gap-5">
            {groups.map(({ row, values }) => (
              <div
                key={row.grainId}
                data-report-chart-row={row.grainId}
                className="w-44 shrink-0 space-y-2 text-center"
              >
                <strong className="block text-xs tabular-nums" dir="ltr">
                  {values.map((value, index) => (
                    <span key={value.currencyCode}>
                      {index ? ' + ' : ''}
                      <bdi dir="ltr">
                        {formatReportMoney(value.amount)}
                        {metric.money ? (
                          <>
                            {' '}
                            <bdi>{currencySymbol(value.currencyCode)}</bdi>
                          </>
                        ) : null}
                      </bdi>
                    </span>
                  ))}
                </strong>
                <div className="flex h-44 items-stretch justify-center gap-2">
                  {values.map((value) => {
                    const axis = axes.get(value.currencyCode)!;
                    const number = Number(value.amount);
                    const zero = (-axis.min / axis.range) * 100;
                    const position = ((number - axis.min) / axis.range) * 100;
                    const color =
                      colors[
                        currencies.indexOf(value.currencyCode) % colors.length
                      ];
                    return (
                      <span
                        className="relative block w-9 rounded-md bg-slate-200/80 dark:bg-slate-700/80"
                        key={value.currencyCode}
                        title={`${formatReportMoney(value.amount)} ${metric.money ? currencySymbol(value.currencyCode) : metric.label}`}
                      >
                        <span
                          className="absolute inset-x-0 border-t border-slate-500"
                          style={{ bottom: `${zero}%` }}
                          aria-hidden="true"
                        />
                        <span
                          data-currency={value.currencyCode}
                          className="absolute inset-x-0 rounded-md"
                          aria-hidden="true"
                          style={{
                            bottom: `${Math.min(zero, position)}%`,
                            height: `${Math.abs(position - zero)}%`,
                            background: `linear-gradient(to top, ${color}, #17396d)`,
                          }}
                        />
                      </span>
                    );
                  })}
                </div>
                <span className="block break-words text-xs font-bold">
                  {row.branchId} · {row.ownerUserId}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}
