'use client';

import { useEffect, useState } from 'react';
import type { LoginResponse } from '@rubi/contracts';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';
import {
  accessFromSession,
  loadIntake,
  ReservationArrivalTracker,
  ReservationFeedError,
} from './live-feed';
import { ReservationOperationsWorkspace } from './workspace';
import type { RequestView, ViewAccess, ViewState } from './model';

const emptyAccess: ViewAccess = {
  authenticated: false,
  permissions: [],
  branchIds: [],
};
/** Reads the existing public inbox; no mutations or duplicate intake. */
export function LiveReservationQueue() {
  const [view, setView] = useState<{
    state: ViewState;
    rows: RequestView[];
    access: ViewAccess;
    newCount: number;
    now: string;
  }>({
    state: 'LOADING',
    rows: [],
    access: emptyAccess,
    newCount: 0,
    now: '1970-01-01T00:00:00.000Z',
  });

  useEffect(() => {
    let disposed = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let session: LoginResponse | null = null;
    let tracker = new ReservationArrivalTracker();
    let scopeIdentity = '';
    const controller = new AbortController();
    const baseUrl = getPublicApiBaseUrl();
    async function update() {
      if (disposed || running || document.visibilityState === 'hidden') return;
      if (timer) clearTimeout(timer);
      running = true;
      try {
        if (!baseUrl) throw new ReservationFeedError('NOT_CONFIGURED');
        session ??= await refreshAuthenticatedSession(baseUrl);
        if (disposed) return;
        if (!session) throw new ReservationFeedError('UNAUTHORIZED');
        const access = accessFromSession(session);
        if (!access.permissions.includes('reservations.read'))
          throw new ReservationFeedError('FORBIDDEN');
        let rows: RequestView[];
        try {
          rows = await loadIntake(baseUrl, session, controller.signal);
        } catch (error) {
          if (
            !(error instanceof ReservationFeedError) ||
            error.state !== 'UNAUTHORIZED'
          )
            throw error;
          session = await refreshAuthenticatedSession(baseUrl);
          if (disposed) return;
          if (!session) throw error;
          rows = await loadIntake(baseUrl, session, controller.signal);
        }
        if (disposed) return;
        const nextIdentity = `${session!.user.id}:${session!.user.branches
          .map((b) => b.id)
          .sort()
          .join(',')}`;
        const changedScope = nextIdentity !== scopeIdentity;
        if (changedScope) {
          tracker = new ReservationArrivalTracker();
          scopeIdentity = nextIdentity;
        }
        const count = tracker.observe(rows);
        setView((current) => ({
          state: 'SUCCESS',
          rows,
          access: accessFromSession(session!),
          newCount: (changedScope ? 0 : current.newCount) + count,
          now: new Date().toISOString(),
        }));
      } catch (error) {
        if (disposed) return;
        const state =
          error instanceof ReservationFeedError ? error.state : 'ERROR';
        setView((current) => ({
          ...current,
          rows: [],
          state,
          newCount: 0,
          access: session ? accessFromSession(session) : emptyAccess,
        }));
      } finally {
        running = false;
        if (!disposed)
          timer = setTimeout(() => {
            void update();
          }, 30_000);
      }
    }
    const resume = () => {
      if (document.visibilityState === 'visible') void update();
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('reservation-workflow-changed', resume);
    void update();
    return () => {
      disposed = true;
      controller.abort();
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('reservation-workflow-changed', resume);
    };
  }, []);
  return (
    <>
      <ReservationOperationsWorkspace
        state={view.state}
        rows={view.rows}
        access={view.access}
        now={view.now}
        initialSection="inbox"
        newRequestCount={view.newCount}
        onDismissNewRequests={() =>
          setView((current) => ({ ...current, newCount: 0 }))
        }
      />
      <p dir="rtl" className="mt-3 text-xs leading-6 text-muted-foreground">
        اعلان درخواست جدید داخل همین صفحه نمایش داده می‌شود. ارسال دائمی به
        زنگوله پس از اتصال سرویس اعلان فعال می‌شود. وضعیت کارگزار، ابطال و صدور
        از آخرین ثبت عملیاتی خوانده می‌شود.
      </p>
    </>
  );
}
