'use client';

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  calendarMonthDays,
  calendarMonthLabel,
  moveCalendarMonth,
  type CalendarSystem,
} from '@/components/ui/date-picker.utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';
import { Badge, Card, EmptyState } from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';
import { campaignStatusLabels, type CampaignPreview } from '../model/marketing';

const weekdayLabels = {
  persian: [
    'شنبه',
    'یکشنبه',
    'دوشنبه',
    'سه‌شنبه',
    'چهارشنبه',
    'پنجشنبه',
    'جمعه',
  ],
  gregorian: [
    'یکشنبه',
    'دوشنبه',
    'سه‌شنبه',
    'چهارشنبه',
    'پنجشنبه',
    'جمعه',
    'شنبه',
  ],
} satisfies Record<CalendarSystem, string[]>;

function campaignsOnDay(
  campaigns: readonly CampaignPreview[],
  isoDate: string,
): readonly CampaignPreview[] {
  return campaigns.filter(
    (campaign) =>
      campaign.startsAt.slice(0, 10) <= isoDate &&
      campaign.endsAt.slice(0, 10) >= isoDate,
  );
}

export function CampaignCalendar({
  campaigns,
  onOpen,
}: {
  campaigns: readonly CampaignPreview[];
  onOpen: (campaign: CampaignPreview) => void;
}) {
  const [system, setSystem] = useState<CalendarSystem>('persian');
  const [anchor, setAnchor] = useState(() => new Date(2026, 8, 2, 12));
  const days = useMemo(
    () => calendarMonthDays(anchor, system),
    [anchor, system],
  );
  const monthCampaigns = useMemo(
    () =>
      campaigns.filter((campaign) =>
        days.some(
          (day) =>
            day.isCurrentMonth &&
            campaign.startsAt.slice(0, 10) <= day.isoDate &&
            campaign.endsAt.slice(0, 10) >= day.isoDate,
        ),
      ),
    [campaigns, days],
  );

  return (
    <section className="grid gap-4" aria-label="تقویم کمپین‌ها">
      <Card className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
            <CalendarDays aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h3 className="font-black">{calendarMonthLabel(anchor, system)}</h3>
            <p className="text-xs text-muted-foreground">
              {monthCampaigns.length.toLocaleString('fa-IR')} کمپین در این ماه
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={system}
            onValueChange={(value) => setSystem(value as CalendarSystem)}
          >
            <SelectTrigger aria-label="نوع تقویم" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="persian">تقویم شمسی</SelectItem>
              <SelectItem value="gregorian">تقویم میلادی</SelectItem>
            </SelectContent>
          </Select>
          <Button
            aria-label="ماه قبل"
            onClick={() =>
              setAnchor((value) => moveCalendarMonth(value, -1, system))
            }
            size="icon"
            variant="outline"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
          <Button
            onClick={() => setAnchor(new Date(2026, 8, 2, 12))}
            variant="outline"
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            امروز
          </Button>
          <Button
            aria-label="ماه بعد"
            onClick={() =>
              setAnchor((value) => moveCalendarMonth(value, 1, system))
            }
            size="icon"
            variant="outline"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </Card>

      {monthCampaigns.length ? (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-muted/55 text-center text-[10px] font-bold text-muted-foreground sm:text-xs">
            {weekdayLabels[system].map((label) => (
              <div className="px-1 py-3" key={label}>
                <span className="sm:hidden">{label.slice(0, 1)}</span>
                <span className="hidden sm:inline">{label}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const events = campaignsOnDay(campaigns, day.isoDate);
              return (
                <div
                  className={cn(
                    'min-h-24 border-b border-e border-border p-1.5 sm:min-h-32 sm:p-2',
                    !day.isCurrentMonth && 'bg-muted/25 text-muted-foreground',
                    day.isToday && 'bg-primary/5',
                  )}
                  key={day.isoDate}
                >
                  <time
                    className={cn(
                      'grid size-6 place-items-center rounded-full text-xs font-bold sm:size-7',
                      day.isToday && 'bg-primary text-primary-foreground',
                    )}
                    dateTime={day.isoDate}
                  >
                    {day.day.toLocaleString('fa-IR')}
                  </time>
                  <div className="mt-1 grid gap-1">
                    {events.slice(0, 2).map((campaign) => (
                      <button
                        className="min-w-0 rounded-md bg-blue-100 px-1 py-1 text-start text-[9px] font-bold text-blue-900 outline-none hover:bg-blue-200 focus-visible:ring-2 focus-visible:ring-ring sm:px-2 sm:text-[10px]"
                        key={campaign.id}
                        onClick={() => onOpen(campaign)}
                        title={`${campaign.name} — ${campaignStatusLabels[campaign.status]}`}
                        type="button"
                      >
                        <span className="block truncate">{campaign.name}</span>
                      </button>
                    ))}
                    {events.length > 2 ? (
                      <Badge className="justify-center px-1 py-0.5 text-[8px] sm:text-[9px]">
                        +{(events.length - 2).toLocaleString('fa-IR')}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <EmptyState
          title="در این ماه کمپینی نیست"
          description="ماه قبل یا بعد را انتخاب کنید یا با دکمه امروز به ماه جاری برگردید."
        />
      )}
    </section>
  );
}
