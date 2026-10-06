'use client';

import { Badge, Card } from '@/components/ui/surfaces';
import {
  campaignChannelLabels,
  campaignStatusLabels,
  executionCompanyLabels,
  type CampaignPreview,
} from '../model/marketing';

function Definition({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words font-bold">{value || '—'}</dd>
    </div>
  );
}

export function CampaignDetail({ campaign }: { campaign: CampaignPreview }) {
  return (
    <div className="mt-5 grid gap-4" dir="rtl">
      <Card className="grid gap-4 p-5 md:grid-cols-3">
        <Definition label="کد داخلی" value={campaign.internalCode} />
        <Definition label="نوع کمپین" value={campaign.campaignType} />
        <div>
          <dt className="text-xs text-muted-foreground">وضعیت</dt>
          <dd className="mt-1">
            <Badge>{campaignStatusLabels[campaign.status]}</Badge>
          </dd>
        </div>
        <Definition label="هدف" value={campaign.objective} />
        <Definition
          label="شرکت مجری"
          value={
            executionCompanyLabels[campaign.executionCompany] ??
            campaign.executionCompany
          }
        />
        <Definition
          label="مسئول"
          value={campaign.ownerUserId ?? campaign.ownerRole}
        />
        <Definition label="شروع" value={campaign.startsAt} />
        <Definition label="پایان" value={campaign.endsAt} />
        <Definition label="مخاطب" value={campaign.audienceSummary} />
        <Definition
          label="کانال‌ها"
          value={campaign.channels
            .map((channel) => campaignChannelLabels[channel])
            .join('، ')}
        />
        <Definition
          label="بودجه"
          value={`${campaign.budgetAmount} ${campaign.budgetCurrencyCode ?? campaign.currencyCode}`}
        />
        <Definition
          label="هدف فروش"
          value={`${campaign.salesTarget} ${campaign.targetCurrencyCode ?? campaign.currencyCode}`}
        />
        <Definition label="پیشرفت" value={`${campaign.progressPercent}%`} />
        <Definition
          label="اعلام‌کننده"
          value={campaign.declaredByUserId ?? '—'}
        />
        <Definition label="زمان اعلام" value={campaign.declaredAt ?? '—'} />
      </Card>

      <Card className="grid gap-4 p-5 md:grid-cols-2">
        <h3 className="font-black md:col-span-2">هزینه‌های ثبت‌شده</h3>
        {campaign.spendLines?.length ? (
          campaign.spendLines.map((line) => (
            <Definition
              key={line.id ?? `${line.label}-${line.currencyCode}`}
              label={line.label}
              value={`${line.amount} ${line.currencyCode}`}
            />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            هنوز هزینه‌ای اعلام نشده است.
          </p>
        )}
        {campaign.spendTotals?.map((total) => (
          <Definition
            key={total.currencyCode}
            label={`جمع ${total.currencyCode}`}
            value={`${total.amount} ${total.currencyCode}`}
          />
        ))}
      </Card>

      <Card className="grid gap-4 p-5 md:grid-cols-2">
        <h3 className="font-black md:col-span-2">ردیابی و لینک‌ها</h3>
        <Definition label="UTM Source" value={campaign.utmSource ?? ''} />
        <Definition label="UTM Medium" value={campaign.utmMedium ?? ''} />
        <Definition label="UTM Campaign" value={campaign.utmCampaign} />
        <Definition label="UTM Term" value={campaign.utmTerm ?? ''} />
        <Definition label="UTM Content" value={campaign.utmContent ?? ''} />
        <Definition label="سقف تکرار" value={campaign.frequencyCap} />
        <div className="md:col-span-2">
          <dt className="text-xs text-muted-foreground">لینک‌های ذخیره‌شده</dt>
          <dd className="mt-2 grid gap-2" dir="ltr">
            {campaign.links?.length
              ? campaign.links.map((link) => (
                  <a
                    className="break-all text-sm text-primary underline"
                    href={link}
                    key={link}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {link}
                  </a>
                ))
              : '—'}
          </dd>
        </div>
      </Card>
    </div>
  );
}
