'use client';
import { useState } from 'react';
import {
  Home,
  Plane,
  Hotel,
  ShoppingCart,
  Wallet,
  FileText,
  LogIn,
  MapPin,
  UsersRound,
  Bus,
  TrainFront,
  Globe,
  Compass,
  BookOpen,
  LifeBuoy,
  Info,
  ArrowLeft,
  X,
} from 'lucide-react';
import type { SitePresenceV1 } from '../api/client';
import { presenceNeighbours } from '../presence-model';
import styles from './site-presence.module.css';

export const presenceIcons: Record<string, typeof Home> = {
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
  train: TrainFront,
  bus: Bus,
  visa: Globe,
  destination: Compass,
  services: MapPin,
  guide: BookOpen,
  support: LifeBuoy,
  info: Info,
};

export function SiteNavigationMap({ data }: { data: SitePresenceV1 }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const home = data.nodes.find((node) => node.id === 'home')!;
  const selected = data.nodes.find((node) => node.id === selectedId);
  const related = selected ? presenceNeighbours(data, selected.id) : null;
  function nodeCard(node: SitePresenceV1['nodes'][number], root = false) {
    const Icon = presenceIcons[node.kind] ?? FileText;
    const fromHome = data.edges.some(
      (edge) => edge.from === 'home' && edge.to === node.id,
    );
    return (
      <button
        type="button"
        key={node.id}
        className={`${styles.siteNode} ${root ? styles.siteHome : ''} ${node.count ? styles.occupied : ''} ${selected?.id === node.id ? styles.siteSelected : ''}`}
        aria-pressed={selected?.id === node.id}
        onClick={() => setSelectedId(selected?.id === node.id ? null : node.id)}
      >
        <span className={styles.siteNodeTitle}>
          <Icon aria-hidden="true" />
          {node.title}
        </span>
        <strong>{node.count?.toLocaleString('fa-IR')}</strong>
        {fromHome ? (
          <span className={styles.homeAccess}>
            <Home aria-hidden="true" />
            از خانه
          </span>
        ) : null}
      </button>
    );
  }
  return (
    <div className={styles.navigationMap} aria-label="نقشه دسته‌بندی‌شده سایت">
      <p className={styles.siteHint}>
        برای دیدن ارتباط بخش‌ها، کارت موردنظر را انتخاب کنید.
      </p>
      <div className={styles.siteRoot}>{nodeCard(home, true)}</div>
      <div className={styles.siteGroups}>
        {data.groups?.map((group) => (
          <section key={group.id} className={styles.siteGroup}>
            <h4>{group.title}</h4>
            <div className={styles.siteGroupNodes}>
              {data.nodes
                .filter((node) => node.group === group.id)
                .map((node) => nodeCard(node))}
            </div>
          </section>
        ))}
      </div>
      {selected && related ? (
        <section className={styles.siteConnections} aria-live="polite">
          <div className={styles.siteConnectionsHeading}>
            <h4>ارتباط‌های {selected.title}</h4>
            <button
              type="button"
              aria-label="بستن ارتباط‌های بخش"
              onClick={() => setSelectedId(null)}
            >
              <X aria-hidden="true" />
            </button>
          </div>
          {(['incoming', 'outgoing'] as const).map((direction) =>
            related[direction].length ? (
              <div className={styles.siteConnectionRow} key={direction}>
                <span>{direction === 'incoming' ? 'ورود از' : 'ادامه به'}</span>
                <div>
                  {related[direction].map((node) => (
                    <button
                      type="button"
                      key={node.id}
                      onClick={() => setSelectedId(node.id)}
                    >
                      <ArrowLeft aria-hidden="true" />
                      {node.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : null,
          )}
          {!related.incoming.length && !related.outgoing.length ? (
            <p>این بخش مسیر اختصاصی در نقشه ندارد.</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
