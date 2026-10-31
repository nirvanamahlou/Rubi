'use client';
import { useEffect, useState } from 'react';
import { ShieldCheck, Settings2, Files } from 'lucide-react';
import Link from '@/components/access-link';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { InsurancePolicies } from './policies';
import { InsuranceSettings } from './settings';
import styles from './workspace.module.css';

export function InsuranceWorkspace() {
  const [tab, setTab] = useState<'policies' | 'settings'>('policies');
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branchId, setBranchId] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    const base = getPublicApiBaseUrl();
    Promise.resolve()
      .then(() => {
        if (!base) throw new Error('نشانی سرور تنظیم نشده است.');
        return refreshAuthenticatedSession(base);
      })
      .then((session) => {
        if (!active) return;
        if (
          new URLSearchParams(window.location.search).get('tab') === 'settings'
        )
          setTab('settings');
        if (!session?.user.permissions.includes('reservations.read')) {
          setError('دسترسی رزرواسیون لازم است.');
          return;
        }
        setBranches(session.user.branches);
        setBranchId(session.user.branches[0]?.id ?? '');
        setReady(true);
      })
      .catch(() => {
        if (active) setError('اطلاعات دسترسی دریافت نشد.');
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <main className={styles.workspace} dir="rtl">
      <header className={styles.hero}>
        <div className={styles.title}>
          <ShieldCheck size={28} />
          <div>
            <h1>بیمه مسافرتی</h1>
            <p>تنظیمات صدور و مدیریت بیمه‌نامه‌های مسافران</p>
          </div>
        </div>
        <Link href="/reservations">بازگشت به رزرواسیون</Link>
      </header>
      <nav className={styles.tabs} aria-label="بخش‌های بیمه">
        <button
          type="button"
          className={tab === 'policies' ? styles.selected : ''}
          aria-current={tab === 'policies' ? 'page' : undefined}
          onClick={() => setTab('policies')}
        >
          <Files size={18} />
          مدیریت و اصلاح بیمه‌نامه‌ها
        </button>
        <button
          type="button"
          className={tab === 'settings' ? styles.selected : ''}
          aria-current={tab === 'settings' ? 'page' : undefined}
          onClick={() => setTab('settings')}
        >
          <Settings2 size={18} />
          تنظیمات صدور بیمه‌نامه
        </button>
      </nav>
      <p className={styles.connection}>
        اتصال بیمه‌گر هنوز فعال نشده است. تنظیمات و پیش‌نویس‌ها قابل ثبت‌اند؛
        صدور و ابطال پس از اتصال فعال می‌شوند.
      </p>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {ready &&
        (tab === 'policies' ? (
          <InsurancePolicies branches={branches} />
        ) : (
          <>
            <label className={styles.branch}>
              شعبه
              <NativeSearchSelect
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </NativeSearchSelect>
            </label>
            {branchId && (
              <InsuranceSettings key={branchId} branchId={branchId} />
            )}
          </>
        ))}
    </main>
  );
}
