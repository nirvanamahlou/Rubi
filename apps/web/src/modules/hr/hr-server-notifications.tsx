'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { HrNotificationDto } from '@rubi/contracts';
import { X, CheckCheck } from 'lucide-react';
import { hrApi } from './hr-api';
import { HrButton } from './hr-controls';
import styles from './hr-workspace.module.css';
import ui from './hr-unified.module.css';

export function HrServerNotifications({
  onSelect,
}: {
  onSelect: (id: string) => Promise<void>;
}) {
  const [items, setItems] = useState<HrNotificationDto[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const bell = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const unread = items.filter((item) => !item.readAt).length;
  const refresh = useCallback(async () => {
    try {
      setItems(await hrApi.notifications());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'دریافت اعلان‌ها انجام نشد.');
    }
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => {
      void refresh();
    }, 0);
    const update = () => {
      void refresh();
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 30000);
    window.addEventListener('rubi:hr-server-change', update);
    window.addEventListener('focus', update);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(initial);
      window.removeEventListener('rubi:hr-server-change', update);
      window.removeEventListener('focus', update);
    };
  }, [refresh]);
  useEffect(() => {
    const element = document.querySelector<HTMLButtonElement>(
      'button[aria-label^="اعلان‌ها"]',
    );
    if (!element) return;
    bell.current = element;
    const toggle = () => setOpen((value) => !value);
    element.classList.add(styles.notificationBellConnected!);
    element.addEventListener('click', toggle);
    return () => {
      element.removeEventListener('click', toggle);
      element.classList.remove(
        styles.notificationBellConnected!,
        styles.notificationBellHasUnread!,
      );
      element.removeAttribute('data-unread');
      element.removeAttribute('aria-expanded');
      element.setAttribute('aria-label', 'اعلان‌ها');
    };
  }, []);
  useEffect(() => {
    if (!bell.current) return;
    bell.current.classList.toggle(
      styles.notificationBellHasUnread!,
      unread > 0,
    );
    bell.current.dataset.unread = unread.toLocaleString('fa-IR');
    bell.current.setAttribute(
      'aria-label',
      unread
        ? `اعلان‌ها (${unread.toLocaleString('fa-IR')} خوانده‌نشده)`
        : 'اعلان‌ها',
    );
    bell.current.setAttribute('aria-expanded', String(open));
  }, [unread, open]);
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        bell.current?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (
        !panel.current?.contains(event.target as Node) &&
        !bell.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('keydown', close);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open]);
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-label="اعلان‌های منابع انسانی"
      className={styles.notificationPanel}
      ref={panel}
      tabIndex={-1}
      dir="rtl"
    >
      <div className={styles.notificationHeader}>
        <strong>اعلان‌های منابع انسانی</strong>
        <HrButton
          aria-label="بستن اعلان‌ها"
          onClick={() => {
            setOpen(false);
            bell.current?.focus();
          }}
        >
          <X size={16} />
        </HrButton>
      </div>
      {error ? (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      ) : null}
      <HrButton
        onClick={async () => {
          try {
            for (const item of items.filter((item) => !item.readAt))
              await hrApi.readNotification(item.id);
            await refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'ثبت خواندن انجام نشد.');
          }
        }}
      >
        <CheckCheck size={16} />
        خواندن همه
      </HrButton>
      <ul className={ui.notificationList}>
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={ui.link}
              onClick={async () => {
                try {
                  if (item.recordId) await onSelect(item.recordId);
                  await hrApi.readNotification(item.id);
                  await refresh();
                  setOpen(false);
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : 'نمایش اعلان انجام نشد.',
                  );
                }
              }}
            >
              {!item.readAt ? '● ' : ''}
              {item.title}
            </button>
            <p className={ui.muted}>
              {new Date(item.createdAt).toLocaleString('fa-IR')}
            </p>
          </li>
        ))}
      </ul>
      {!items.length ? <p className={ui.empty}>اعلانی ثبت نشده است.</p> : null}
    </div>
  );
}
