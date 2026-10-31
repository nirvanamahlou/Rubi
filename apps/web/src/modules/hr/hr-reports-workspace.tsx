'use client';
import Link from '@/components/access-link';
import type { HrStore } from './hr-store';
import { HrReports } from './hr-reports';
import { HrAudit } from './hr-audit';
import { HrLeaveBalance } from './hr-leave-balance';
import { sectionTabs } from './hr.model';
import ui from './hr-unified.module.css';

export function HrReportsWorkspace({
  store,
  tab,
}: {
  store: HrStore;
  tab?: string | undefined;
}) {
  const auditAllowed = Boolean(store.data?.capabilities.audit);
  const activeTab =
    tab === 'audit' || tab === 'leaveBalance' ? tab : 'dashboard';
  return (
    <div className={ui.spaced}>
      <header className={ui.heading}>
        <h1>گزارش و Audit</h1>
      </header>
      <nav className={ui.tabs} aria-label="گزارش و Audit">
        {sectionTabs
          .reports!.filter((item) => item.id !== 'audit' || auditAllowed)
          .map((item) => (
            <Link
              key={item.id}
              href={`/hr?section=reports&tab=${item.id}`}
              aria-current={activeTab === item.id ? 'page' : undefined}
              className={activeTab === item.id ? ui.activeTab : ''}
            >
              {item.label}
            </Link>
          ))}
      </nav>
      {activeTab === 'audit' ? (
        auditAllowed ? (
          <HrAudit store={store} />
        ) : (
          <p role="alert">دسترسی به این بخش مجاز نیست.</p>
        )
      ) : activeTab === 'leaveBalance' ? (
        <HrLeaveBalance store={store} initialView="report" reportsOnly />
      ) : (
        <HrReports store={store} initialTopic="radan:daily" embedded />
      )}
    </div>
  );
}
