'use client';
import { HrLiveWorkspace } from './hr-live-workspace';
import ui from './hr-unified.module.css';
export function HrWorkspace(props: Parameters<typeof HrLiveWorkspace>[0]) {
  return <HrLiveWorkspace {...props} />;
}
export function HrState({
  state,
}: {
  state: 'loading' | 'empty' | 'error' | 'unauthorized' | 'forbidden';
}) {
  const labels = {
    loading: 'در حال دریافت منابع انسانی…',
    empty: 'رکوردی وجود ندارد.',
    error: 'بارگذاری منابع انسانی انجام نشد. دوباره تلاش کنید.',
    unauthorized: 'برای دسترسی دوباره وارد سامانه شوید.',
    forbidden: 'برای مشاهده این بخش دسترسی ندارید.',
  };
  return (
    <div
      dir="rtl"
      className={state === 'error' ? ui.error : ui.loading}
      role={state === 'error' ? 'alert' : 'status'}
    >
      {labels[state]}
    </div>
  );
}
