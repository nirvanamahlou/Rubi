'use client';

import { useEffect, useState } from 'react';
import type { MarketingAssetKind } from '@nora/contracts';
import { BarChart3 } from 'lucide-react';
import { NOTIFICATIONS_CHANGED_EVENT } from '@/modules/notifications/api/client';
import { marketingApi } from '../api/records-client';

const assetKinds = {
  audiences: ['SEGMENT', 'AUDIENCE', 'SOURCE'],
  communications: ['MESSAGE', 'SCHEDULE'],
  content: ['FORM', 'LANDING_PAGE', 'SHORT_LINK'],
  offers: ['COUPON', 'OFFER'],
  journeys: ['AUTOMATION'],
} satisfies Record<string, MarketingAssetKind[]>;

type Section = keyof typeof assetKinds | 'campaigns' | 'leads';
type Metric = readonly [label: string, value: number];

async function loadMetrics(section: Section): Promise<Metric[]> {
  if (section === 'campaigns') {
    const [total, draft, active, scheduled] = await Promise.all([
      marketingApi.campaignPage({ pageSize: 1 }),
      marketingApi.campaignPage({ pageSize: 1, status: 'DRAFT' }),
      marketingApi.campaignPage({ pageSize: 1, status: 'ACTIVE' }),
      marketingApi.campaignPage({ pageSize: 1, status: 'SCHEDULED' }),
    ]);
    return [
      ['همه کمپین‌ها', total.total],
      ['پیش‌نویس', draft.total],
      ['فعال', active.total],
      ['زمان‌بندی‌شده', scheduled.total],
    ];
  }
  if (section === 'leads') {
    const { data } = await marketingApi.intakes();
    return [
      ['همه سرنخ‌ها', data.length],
      ['جدید', data.filter(({ status }) => status === 'NEW').length],
      [
        'واجد شرایط',
        data.filter(({ status }) => status === 'QUALIFIED').length,
      ],
      [
        'دارای مسئول',
        data.filter(({ assigneeUserId }) => assigneeUserId).length,
      ],
    ];
  }

  const assets = (
    await Promise.all(
      assetKinds[section].map((kind) => marketingApi.assets(kind)),
    )
  ).flatMap(({ data }) => data);
  const count = (kind: MarketingAssetKind) =>
    assets.filter((asset) => asset.kind === kind).length;
  const status = (value: string) =>
    assets.filter((asset) => asset.status === value).length;
  switch (section) {
    case 'audiences':
      return [
        ['سگمنت‌ها', count('SEGMENT')],
        ['مخاطبان', count('AUDIENCE')],
        ['منابع ورود', count('SOURCE')],
        [
          'مخاطبان متصل به کمپین',
          assets.filter(
            ({ kind, campaignId }) => kind === 'AUDIENCE' && campaignId,
          ).length,
        ],
      ];
    case 'communications':
      return [
        ['پیام‌ها', count('MESSAGE')],
        ['برنامه‌های ارسال', count('SCHEDULE')],
        ['پیش‌نویس', status('DRAFT')],
        ['زمان‌بندی‌شده', status('SCHEDULED')],
      ];
    case 'content':
      return [
        ['فرم‌ها', count('FORM')],
        ['صفحات فرود', count('LANDING_PAGE')],
        ['لینک‌های رهگیری', count('SHORT_LINK')],
        ['دارایی‌های فعال', status('ACTIVE')],
      ];
    case 'offers':
      return [
        ['کدهای تخفیف', count('COUPON')],
        ['پیشنهادها', count('OFFER')],
        ['فعال', status('ACTIVE')],
        ['پیش‌نویس', status('DRAFT')],
      ];
    case 'journeys':
      return [
        ['سفرهای ثبت‌شده', assets.length],
        ['فعال', status('ACTIVE')],
        ['پیش‌نویس', status('DRAFT')],
        ['متوقف', status('PAUSED')],
      ];
  }
}

export function MarketingSectionMetrics({ section }: { section: Section }) {
  const [metrics, setMetrics] = useState<Metric[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let sequence = 0;
    const refresh = () => {
      const request = ++sequence;
      void loadMetrics(section)
        .then((result) => {
          if (request !== sequence) return;
          setMetrics(result);
          setFailed(false);
        })
        .catch(() => {
          if (request !== sequence) return;
          setFailed(true);
        });
    };
    refresh();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    return () => {
      sequence++;
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    };
  }, [section]);

  if (failed)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        دریافت شاخص‌های این بخش انجام نشد.
      </p>
    );
  return (
    <div
      aria-label="شاخص‌های بخش"
      aria-busy={!metrics}
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
    >
      {(
        metrics ??
        Array.from({ length: 4 }, () => ['در حال دریافت', null] as const)
      ).map(([label, value], index) => (
        <article
          key={index}
          className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-sm"
        >
          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
            <span>{label}</span>
            <BarChart3
              className="size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
          </div>
          <p className="mt-2 text-xl font-bold tabular-nums text-foreground">
            {value?.toLocaleString('fa-IR') ?? '—'}
          </p>
        </article>
      ))}
    </div>
  );
}
