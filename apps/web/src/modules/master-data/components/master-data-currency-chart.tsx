'use client';

import type { MasterCurrencyRateRecord } from '@nora/contracts';
import { ChartNoAxesCombined } from 'lucide-react';
import { EmptyState } from '@/components/ui/surfaces';

type ChartRate = Pick<
  MasterCurrencyRateRecord,
  | 'id'
  | 'rate'
  | 'status'
  | 'observedAt'
  | 'fromCurrencyCode'
  | 'toCurrencyCode'
>;
const dateLabel = (time: number) =>
  new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Tehran',
  }).format(time);

export function currencyChartData(rates: readonly ChartRate[]) {
  const ordered = rates
    .filter(
      (row) =>
        row.status === 'APPROVED' &&
        Number.isFinite(Number(row.rate)) &&
        Number(row.rate) > 0 &&
        Number.isFinite(Date.parse(row.observedAt)),
    )
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  const first = ordered[0];
  if (!first) return null;
  const start = Date.parse(first.observedAt);
  const end = Date.parse(ordered[ordered.length - 1]!.observedAt);
  const maximum = Math.max(...ordered.map((row) => Number(row.rate))) * 1.05;
  const x = (time: number) =>
    end === start ? 370 : 90 + ((time - start) / (end - start)) * 560;
  const y = (amount: number) => 235 - (amount / maximum) * 195;
  return {
    points: ordered.map((row) => ({
      row,
      x: x(Date.parse(row.observedAt)),
      y: y(Number(row.rate)),
    })),
    dates: (end === start
      ? [start]
      : [start, start + (end - start) / 2, end]
    ).map((time) => ({ x: x(time), label: dateLabel(time) })),
    amounts: [0, 1, 2, 3, 4].map((index) => ({
      y: y((maximum * index) / 4),
      label: ((maximum * index) / 4).toLocaleString('fa-IR', {
        maximumSignificantDigits: 5,
        notation:
          maximum >= 1e9
            ? 'compact'
            : maximum < 0.001
              ? 'scientific'
              : 'standard',
      }),
    })),
  };
}

export function FinanceChart({ rates }: { rates: readonly ChartRate[] }) {
  const chart = currencyChartData(rates);
  if (!chart)
    return (
      <EmptyState
        description="نرخ جدید را ثبت کنید تا در این نمودار نمایش داده شود."
        icon={ChartNoAxesCombined}
        title="نرخ ثبت‌شده‌ای در این بازه نیست"
      />
    );
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-gradient-to-b from-primary/5 to-transparent p-3">
      <svg
        aria-label="نمودار تاریخچه نرخ‌های ثبت‌شده"
        className="h-72 w-full min-w-[40rem]"
        role="img"
        viewBox="0 0 700 300"
        direction="ltr"
      >
        <text x="70" y="20" textAnchor="end" fontSize="14" fill="currentColor">
          مبلغ
        </text>
        <text
          x="370"
          y="287"
          textAnchor="middle"
          fontSize="14"
          fill="currentColor"
        >
          تاریخ
        </text>
        {chart.amounts.map((tick, index) => (
          <g key={index}>
            <line
              x1="90"
              x2="650"
              y1={tick.y}
              y2={tick.y}
              className="stroke-border"
            />
            <text
              x="80"
              y={tick.y + 4}
              textAnchor="end"
              fontSize="12"
              fill="currentColor"
            >
              {tick.label}
            </text>
          </g>
        ))}
        <path
          d="M90 40 V235 H650"
          className="stroke-muted-foreground"
          fill="none"
          strokeWidth="1.5"
        />
        {chart.dates.map((tick, index) => (
          <g key={index}>
            <line
              x1={tick.x}
              x2={tick.x}
              y1="235"
              y2="241"
              className="stroke-muted-foreground"
            />
            <text
              x={tick.x}
              y="260"
              textAnchor="middle"
              fontSize="12"
              fill="currentColor"
            >
              {tick.label}
            </text>
          </g>
        ))}
        <polyline
          fill="none"
          points={chart.points.map(({ x, y }) => `${x},${y}`).join(' ')}
          className="stroke-primary"
          strokeWidth="2"
        />
        {chart.points.map(({ row, x, y }) => (
          <circle
            className="fill-background stroke-primary"
            cx={x}
            cy={y}
            key={row.id}
            r="4"
            strokeWidth="2"
          >
            <title>{`${row.fromCurrencyCode}/${row.toCurrencyCode} · ${row.rate} · ${dateLabel(Date.parse(row.observedAt))}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
