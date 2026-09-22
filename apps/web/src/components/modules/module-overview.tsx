import {
  ArrowLeft,
  CheckCircle2,
  GitBranch,
  type LucideIcon,
} from 'lucide-react';

import { Badge, Card, PageHeader } from '@/components/ui/surfaces';

export interface ModuleSection {
  title: string;
  description?: string;
  items: readonly string[];
  icon?: LucideIcon;
  badge?: string;
}

interface ModuleOverviewProps {
  title: string;
  description: string;
  eyebrow?: string;
  sections: readonly ModuleSection[];
  flow?: readonly string[];
  note?: string;
}

export function ModuleOverview({
  description,
  eyebrow = 'معماری عملیاتی تاییدشده',
  flow,
  note,
  sections,
  title,
}: ModuleOverviewProps) {
  return (
    <div className="space-y-6">
      <PageHeader description={description} eyebrow={eyebrow} title={title} />

      {flow?.length ? (
        <Card className="overflow-hidden border-primary/20 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--primary)_10%,var(--surface)),var(--surface))] p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <GitBranch aria-hidden="true" className="size-4" />
            </span>
            <div>
              <h2 className="font-black text-foreground">زنجیره گردش کار</h2>
              <p className="text-xs text-muted-foreground">
                ترتیب انتقال مسئولیت و اطلاعات بین تیم‌ها
              </p>
            </div>
          </div>
          <ol
            className="flex flex-wrap items-center gap-2"
            aria-label="زنجیره گردش کار"
          >
            {flow.map((step, index) => (
              <li className="flex items-center gap-2" key={step}>
                <span className="rounded-xl border border-primary/15 bg-surface px-3 py-2 text-sm font-bold text-foreground shadow-sm">
                  <span className="ms-1 text-xs text-primary">
                    {(index + 1).toLocaleString('fa-IR')}.
                  </span>
                  {step}
                </span>
                {index < flow.length - 1 ? (
                  <ArrowLeft
                    aria-hidden="true"
                    className="size-4 shrink-0 text-primary"
                  />
                ) : null}
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {note ? (
        <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 px-4 py-3 text-sm leading-7 text-foreground">
          <strong className="text-primary">مرز مسئولیت: </strong>
          {note}
        </div>
      ) : null}

      <section
        aria-label={`زیر‌بخش‌های ${title}`}
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {sections.map(
          ({
            badge,
            description: sectionDescription,
            icon: Icon,
            items,
            title: sectionTitle,
          }) => (
            <Card
              className="group p-5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
              key={sectionTitle}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {Icon ? (
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                  ) : null}
                  <div className="min-w-0">
                    <h2 className="font-black text-foreground">
                      {sectionTitle}
                    </h2>
                    {sectionDescription ? (
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {sectionDescription}
                      </p>
                    ) : null}
                  </div>
                </div>
                {badge ? <Badge className="shrink-0">{badge}</Badge> : null}
              </div>
              <ul className="mt-4 space-y-2.5">
                {items.map((item) => (
                  <li
                    className="flex items-start gap-2 text-sm leading-6 text-muted-foreground"
                    key={item}
                  >
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-1 size-4 shrink-0 text-primary"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ),
        )}
      </section>
    </div>
  );
}
