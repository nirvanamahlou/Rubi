import { CalendarDays, ChartNoAxesCombined, Clock3 } from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
} from '@/components/ui/surfaces';
import { faMessages } from '@/messages/fa';

export function DashboardShell() {
  const messages = faMessages.dashboard;
  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Select defaultValue="week">
            <SelectTrigger aria-label={messages.period} className="w-44">
              <CalendarDays aria-hidden="true" className="size-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">{messages.periods.week}</SelectItem>
              <SelectItem value="month">{messages.periods.month}</SelectItem>
              <SelectItem value="quarter">
                {messages.periods.quarter}
              </SelectItem>
            </SelectContent>
          </Select>
        }
        description={messages.description}
        title={messages.title}
      />
      <Alert description={messages.mockNotice} title="Dashboard Shell" />
      <section
        aria-label="شاخص‌های کلیدی"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {messages.kpis.map((title) => (
          <Card className="p-5" key={title}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-muted-foreground">
                {title}
              </p>
              <Badge>{faMessages.common.demo}</Badge>
            </div>
            <p className="mt-6 text-3xl font-black" aria-label="بدون داده">
              —
            </p>
            <Skeleton className="mt-4 h-2 w-2/3" />
          </Card>
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card className="min-h-80 p-5">
          <div className="flex items-center gap-2">
            <ChartNoAxesCombined
              aria-hidden="true"
              className="size-5 text-primary"
            />
            <h2 className="font-bold">{messages.chartTitle}</h2>
          </div>
          <div className="mt-8 grid h-52 place-items-center rounded-xl border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
            محل نمودار پس از اتصال داده تأییدشده
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Clock3 aria-hidden="true" className="size-5 text-primary" />
            <h2 className="font-bold">{messages.recentActivity}</h2>
          </div>
          <EmptyState
            description="فعالیت‌های واقعی پس از اتصال Backend در این بخش قرار می‌گیرند."
            title={faMessages.common.noData}
          />
        </Card>
      </section>
      <Card className="p-5">
        <h2 className="font-bold">{messages.upcomingTasks}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <Skeleton className="h-16" key={item} />
          ))}
        </div>
      </Card>
    </div>
  );
}
