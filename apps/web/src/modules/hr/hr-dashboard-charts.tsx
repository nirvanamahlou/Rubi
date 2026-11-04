'use client';
import { useEffect, useState } from 'react';
import type {
  HrDashboardChartDto,
  HrDashboardChartsDto,
} from '@nora/contracts';
import { hrRequest } from './hr-api';
import { HrButton, HrEmpty, HrLoading, HrPanel } from './hr-controls';
import { hrDisplayDate } from './hr-dates';
import ui from './hr-unified.module.css';

export function HrDashboardChart({ chart }: { chart: HrDashboardChartDto }) {
  const [page, setPage] = useState(0);
  const pageSize = 12;
  const pages = Math.max(1, Math.ceil(chart.points.length / pageSize));
  const current = Math.min(page, pages - 1);
  const points = chart.points.slice(
    current * pageSize,
    (current + 1) * pageSize,
  );
  const maxima = new Map<string, number>();
  for (const point of chart.points)
    maxima.set(
      point.unit,
      Math.max(maxima.get(point.unit) ?? 1, Math.abs(point.value)),
    );
  return (
    <HrPanel title={chart.title} description={chart.description}>
      <p className={ui.muted}>
        {hrDisplayDate(chart.from)} — {hrDisplayDate(chart.to)}
      </p>
      {!points.length ? (
        <HrEmpty title="داده‌ای در این بازه ثبت نشده است." />
      ) : (
        <>
          <div className={ui.spaced}>
            {points.map((point) => (
              <div key={point.key}>
                <div className={ui.actions}>
                  <span>{point.label}</span>
                  <strong style={{ marginInlineStart: 'auto' }}>
                    {point.value.toLocaleString('fa-IR', {
                      maximumFractionDigits: 2,
                    })}{' '}
                    {point.unit}
                  </strong>
                </div>
                <svg
                  width="100%"
                  height="14"
                  viewBox="0 0 500 14"
                  preserveAspectRatio="none"
                  role="img"
                  aria-label={`${point.label}: ${point.value} ${point.unit}`}
                >
                  <rect
                    width="500"
                    height="12"
                    rx="6"
                    fill="var(--secondary)"
                  />
                  <rect
                    x={
                      point.value < 0
                        ? 0
                        : 500 -
                          (Math.abs(point.value) / maxima.get(point.unit)!) *
                            500
                    }
                    width={
                      (Math.abs(point.value) / maxima.get(point.unit)!) * 500
                    }
                    height="12"
                    rx="6"
                    fill={
                      point.value < 0 ? 'var(--destructive)' : 'var(--primary)'
                    }
                  />
                  <title>
                    {point.label}: {point.value} {point.unit}
                  </title>
                </svg>
              </div>
            ))}
          </div>
          {pages > 1 ? (
            <div className={ui.actions}>
              <HrButton
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
              >
                قبلی
              </HrButton>
              <span>
                {(current + 1).toLocaleString('fa-IR')} /{' '}
                {pages.toLocaleString('fa-IR')}
              </span>
              <HrButton
                disabled={current + 1 >= pages}
                onClick={() => setPage(current + 1)}
              >
                بعدی
              </HrButton>
            </div>
          ) : null}
        </>
      )}
    </HrPanel>
  );
}
export function HrDashboardCharts({
  branch,
  unit,
  revision,
}: {
  branch: string;
  unit: string;
  revision: number;
}) {
  const key = JSON.stringify([branch, unit, revision]);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    retry: number;
    data?: HrDashboardChartsDto;
    error?: string;
  } | null>(null);
  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({
      ...(branch ? { organizationBranchId: branch } : {}),
      ...(unit ? { unit } : {}),
    });
    void hrRequest<HrDashboardChartsDto>(`/dashboard/charts?${query}`)
      .then((data) => {
        if (active) setResult({ key, retry, data });
      })
      .catch((error: unknown) => {
        if (active)
          setResult({
            key,
            retry,
            error:
              error instanceof Error
                ? error.message
                : 'دریافت گزارش انجام نشد.',
          });
      });
    return () => {
      active = false;
    };
  }, [branch, unit, key, retry]);
  if (result?.key !== key || result.retry !== retry)
    return <HrLoading label="در حال دریافت نمودارها…" />;
  if (result.error)
    return (
      <div role="alert" className={ui.error}>
        {result.error}{' '}
        <HrButton onClick={() => setRetry(retry + 1)}>تلاش دوباره</HrButton>
      </div>
    );
  return (
    <div className={ui.twoColumns}>
      {result.data?.charts.map((chart) => (
        <HrDashboardChart key={`${key}:${chart.id}`} chart={chart} />
      ))}
    </div>
  );
}
