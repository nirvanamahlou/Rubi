import { ArrowUpLeft, ChevronLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';
import {
  frappeWorkspaces,
  getFrappeWorkspace,
  hrWorkspaceLinkHref,
  type FrappeWorkspaceId,
} from './frappe-workspaces';
import styles from './frappe-workspace.module.css';

const formatFa = (value: number) =>
  new Intl.NumberFormat('fa-IR').format(value);

function WorkspaceSwitcher({ activeId }: { activeId?: FrappeWorkspaceId }) {
  return (
    <nav aria-label="انتخاب فضای کاری Frappe HR" className={styles.switcher}>
      {frappeWorkspaces.map((workspace) => {
        const Icon = workspace.icon;
        const active = workspace.id === activeId;
        return (
          <Link
            aria-current={active ? 'page' : undefined}
            className={styles.switcherItem}
            data-active={active || undefined}
            data-tone={workspace.tone}
            href={`/hr?workspace=${workspace.id}`}
            key={workspace.id}
          >
            <span className={styles.switcherIcon}>
              <Icon aria-hidden="true" size={20} />
            </span>
            <span>{workspace.shortTitle}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function FrappeWorkspaceLauncher() {
  return (
    <section
      aria-labelledby="frappe-workspaces-title"
      className={styles.launcher}
    >
      <div className={styles.launcherHead}>
        <div>
          <span className={styles.eyebrow}>
            <Sparkles aria-hidden="true" size={15} /> الگوی امکانات Frappe HR
          </span>
          <h2 id="frappe-workspaces-title">فضاهای کاری منابع انسانی</h2>
          <p>
            ۹ فضای کاری با شاخص‌های پر، اطلاعات پایه و گزارش‌های متصل به صفحات
            داخلی Rubi
          </p>
        </div>
        <span className={styles.previewBadge}>داده آزمایشی</span>
      </div>
      <div className={styles.launcherGrid}>
        {frappeWorkspaces.map((workspace) => {
          const Icon = workspace.icon;
          const itemCount = workspace.groups.reduce(
            (sum, group) => sum + group.items.length,
            0,
          );
          return (
            <Link
              className={styles.launcherCard}
              data-tone={workspace.tone}
              href={`/hr?workspace=${workspace.id}`}
              key={workspace.id}
            >
              <span className={styles.launcherIcon}>
                <Icon aria-hidden="true" size={25} />
              </span>
              <span className={styles.launcherCopy}>
                <strong>{workspace.title}</strong>
                <small>{workspace.description}</small>
              </span>
              <span className={styles.launcherCount}>
                {formatFa(itemCount)} امکان{' '}
                <ChevronLeft aria-hidden="true" size={15} />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function WorkspaceTrend({ id }: { id: FrappeWorkspaceId }) {
  const workspace = getFrappeWorkspace(id);
  const min = Math.min(...workspace.trend) - 2;
  const max = Math.max(...workspace.trend) + 2;
  const points = workspace.trend.map((value, index) => ({
    value,
    x: 24 + index * (652 / (workspace.trend.length - 1)),
    y: 178 - ((value - min) / (max - min)) * 126,
  }));
  const line = points.map(({ x, y }) => `${x},${y}`).join(' ');
  const area = `24,198 ${line} 676,198`;
  return (
    <article className={styles.chartCard} data-tone={workspace.tone}>
      <div className={styles.chartHead}>
        <div>
          <h2>{workspace.trendLabel}</h2>
          <p>آخرین بروزرسانی: امروز، ۱۰:۳۸</p>
        </div>
        <span>۸ ماه اخیر</span>
      </div>
      <svg
        aria-label={`${workspace.trendLabel}؛ آخرین مقدار ${formatFa(workspace.trend.at(-1) ?? 0)}`}
        className={styles.chart}
        role="img"
        viewBox="0 0 700 220"
      >
        <defs>
          <linearGradient
            id={`workspace-area-${id}`}
            x1="0"
            x2="0"
            y1="0"
            y2="1"
          >
            <stop offset="0" stopColor="currentColor" stopOpacity=".2" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          className={styles.chartGrid}
          d="M24 40H676M24 92H676M24 144H676M24 198H676"
        />
        <polygon fill={`url(#workspace-area-${id})`} points={area} />
        <polyline className={styles.chartLine} points={line} />
        {points.map(({ value, x, y }, index) => (
          <circle
            aria-label={`${formatFa(value)}`}
            className={styles.chartDot}
            cx={x}
            cy={y}
            key={`${workspace.id}-${index}`}
            r={index === points.length - 1 ? 6 : 4}
          />
        ))}
      </svg>
      <div aria-hidden="true" className={styles.chartLabels}>
        {[
          'بهمن',
          'اسفند',
          'فروردین',
          'اردیبهشت',
          'خرداد',
          'تیر',
          'مرداد',
          'شهریور',
        ].map((month) => (
          <span key={month}>{month}</span>
        ))}
      </div>
    </article>
  );
}

export function FrappeWorkspaceScreen({
  workspaceId,
}: {
  workspaceId: FrappeWorkspaceId;
}) {
  const workspace = getFrappeWorkspace(workspaceId);
  const Icon = workspace.icon;
  return (
    <>
      <header className={styles.pageHead} data-tone={workspace.tone}>
        <div>
          <nav aria-label="مسیر صفحه" className={styles.breadcrumb}>
            <Link href="/hr">منابع انسانی</Link>
            <ChevronLeft aria-hidden="true" size={14} />
            <span>{workspace.title}</span>
          </nav>
          <div className={styles.titleRow}>
            <span className={styles.titleIcon}>
              <Icon aria-hidden="true" size={27} />
            </span>
            <div>
              <h1>{workspace.title}</h1>
              <p>{workspace.description}</p>
            </div>
          </div>
        </div>
        <Link className={styles.allCapabilities} href="/hr">
          همه قابلیت‌های HR <ArrowUpLeft aria-hidden="true" size={16} />
        </Link>
      </header>

      <WorkspaceSwitcher activeId={workspaceId} />

      <section
        aria-label={`شاخص‌های آزمایشی ${workspace.title}`}
        className={styles.metrics}
      >
        {workspace.metrics.map((metric) => (
          <article
            className={styles.metricCard}
            data-tone={workspace.tone}
            key={metric.label}
          >
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.hint}</small>
          </article>
        ))}
      </section>

      <WorkspaceTrend id={workspaceId} />

      <section
        aria-labelledby="workspace-groups-title"
        className={styles.directory}
      >
        <div className={styles.directoryHead}>
          <div>
            <h2 id="workspace-groups-title">اطلاعات پایه و گزارش‌ها</h2>
            <p>
              هر گزینه به صفحه و تب مرتبط در ماژول منابع انسانی Rubi متصل است.
            </p>
          </div>
          <span className={styles.previewBadge}>داده آزمایشی</span>
        </div>
        <div className={styles.groupGrid}>
          {workspace.groups.map((group) => (
            <article className={styles.groupCard} key={group.title}>
              <h3>{group.title}</h3>
              <ul>
                {group.items.map((item, index) => (
                  <li key={`${item.label}-${index}`}>
                    <Link href={hrWorkspaceLinkHref(item)}>
                      <span>{item.label}</span>
                      <ArrowUpLeft aria-hidden="true" size={14} />
                    </Link>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
