'use client';
import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  RefreshCw,
  UsersRound,
  Home,
  Plane,
  Hotel,
  ShoppingCart,
  Wallet,
  FileText,
  LogIn,
  MapPin,
} from 'lucide-react';
import { Card, Badge, Alert } from '@/components/ui/surfaces';
import { Button } from '@/components/ui/button';
import {
  integrationsApi,
  IntegrationsApiError,
  type SitePresenceV1,
} from '../api/client';
import { presenceLayout, validatePresence } from '../presence-model';
import styles from './site-presence.module.css';
const icons: Record<string, typeof Home> = {
  home: Home,
  plane: Plane,
  tour: MapPin,
  hotel: Hotel,
  cart: ShoppingCart,
  wallet: Wallet,
  orders: FileText,
  receipt: FileText,
  login: LogIn,
  users: UsersRound,
};
export function SitePresence({
  branchId,
  siteId,
  siteName,
}: {
  branchId: string;
  siteId: string;
  siteName: string;
}) {
  const [snapshot, setSnapshot] = useState<SitePresenceV1 | null>(null);
  const [state, setState] = useState<
    'loading' | 'active' | 'disabled' | 'error'
  >('loading');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let disposed = false,
      inflight = false;
    let pending: AbortController | undefined;
    async function refresh() {
      if (disposed || inflight || document.visibilityState !== 'visible')
        return;
      inflight = true;
      const control = new AbortController();
      pending = control;
      const timeout = setTimeout(() => control.abort(), 12000);
      try {
        const result = validatePresence(
          await integrationsApi.sitePresence(branchId, siteId, control.signal),
          siteId,
        );
        if (!disposed) {
          setSnapshot(result);
          setState(result.state === 'ACTIVE' ? 'active' : 'disabled');
          setError('');
        }
      } catch (e) {
        if (!disposed) {
          setSnapshot(null);
          setState(
            e instanceof IntegrationsApiError && e.status === 404
              ? 'disabled'
              : 'error',
          );
          setError(
            e instanceof Error ? e.message : 'مانیتورینگ سایت پاسخ نداد.',
          );
        }
      } finally {
        clearTimeout(timeout);
        inflight = false;
      }
    }
    void refresh();
    const interval = setInterval(() => void refresh(), 15000);
    const visible = () => {
      if (document.visibilityState === 'visible') {
        setSnapshot(null);
        setState('loading');
        void refresh();
      }
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      disposed = true;
      pending?.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [branchId, siteId, revision]);
  const data =
    snapshot?.registrySystemId === siteId && state === 'active'
      ? snapshot
      : null;
  const { width, height } = presenceLayout(data?.nodes ?? []);
  const time = data
    ? new Date(data.checkedAt).toLocaleTimeString('fa-IR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Tehran',
      })
    : '';
  return (
    <Card className={styles.panel}>
      <header className={styles.header}>
        <div>
          <h3>
            <Activity aria-hidden="true" />
            حضور زنده در {siteName}
          </h3>
          <p>حضور مرورگرها در بخش‌های سایت · مستقل از بازهٔ گزارش</p>
        </div>
        <div className={styles.actions}>
          <Badge>
            {state === 'active'
              ? 'متصل'
              : state === 'loading'
                ? 'دریافت…'
                : state === 'disabled'
                  ? 'نیازمند راه‌اندازی'
                  : 'ارتباط قطع'}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            aria-label="به‌روزرسانی حضور زنده"
            onClick={() => setRevision((n) => n + 1)}
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </header>
      {data ? (
        <>
          <div className={styles.summary}>
            <strong>
              {data.total?.toLocaleString('fa-IR')} <span>مرورگر فعال</span>
            </strong>
            <span>
              {data.activeWindowSeconds.toLocaleString('fa-IR')} ثانیهٔ اخیر ·
              به‌روزرسانی {time}
            </span>
          </div>
          <div
            className={styles.viewport}
            tabIndex={0}
            aria-label="نقشه حضور در بخش‌های سایت"
          >
            <div className={styles.map} style={{ width, height }}>
              <svg
                className={styles.edges}
                width={width}
                height={height}
                aria-hidden="true"
              >
                <defs>
                  <marker
                    id={`arrow-${siteId}`}
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="5"
                    markerHeight="5"
                    orient="auto-start-reverse"
                  >
                    <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
                  </marker>
                </defs>
                {data.edges.map((edge) => {
                  const a = data.nodes.find((n) => n.id === edge.from),
                    b = data.nodes.find((n) => n.id === edge.to);
                  if (!a || !b || a.column === null || b.column === null)
                    return null;
                  const x1 = width - a.column * 184 - 162,
                    y1 = a.row! * 104 + 42,
                    x2 = width - b.column * 184,
                    y2 = b.row! * 104 + 42,
                    mid = (x1 + x2) / 2;
                  return (
                    <path
                      key={edge.from + edge.to}
                      d={`M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`}
                      markerEnd={`url(#arrow-${siteId})`}
                    />
                  );
                })}
              </svg>
              {data.nodes
                .filter((n) => n.column !== null)
                .map((node) => {
                  const Icon = Object.hasOwn(icons, node.kind)
                    ? icons[node.kind]!
                    : FileText;
                  return (
                    <div
                      key={node.id}
                      className={`${styles.node} ${node.count ? styles.occupied : ''}`}
                      style={{
                        insetInlineStart: node.column! * 184,
                        top: node.row! * 104,
                      }}
                    >
                      <span>
                        <Icon aria-hidden="true" />
                        {node.title}
                      </span>
                      <strong>{node.count?.toLocaleString('fa-IR')}</strong>
                    </div>
                  );
                })}
            </div>
          </div>
          <div className={styles.other}>
            {data.nodes
              .filter((n) => n.column === null)
              .map((node) => (
                <span key={node.id}>
                  {node.title}
                  <strong>{node.count?.toLocaleString('fa-IR')}</strong>
                </span>
              ))}
          </div>
          <p className={styles.note}>
            <ArrowLeft aria-hidden="true" />
            مسیرهای سایت؛ اعداد، حضور فعلی‌اند و به معنی خرید موفق نیستند.
          </p>
        </>
      ) : state === 'error' ? (
        <Alert tone="error" title="حضور زنده دریافت نشد" description={error} />
      ) : (
        <p className={styles.empty}>
          {state === 'loading'
            ? 'در حال دریافت وضعیت سایت…'
            : 'مانیتورینگ حضور این سایت هنوز راه‌اندازی نشده است.'}
        </p>
      )}
    </Card>
  );
}
