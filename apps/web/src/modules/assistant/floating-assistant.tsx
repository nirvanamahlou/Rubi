'use client';

import dynamic from 'next/dynamic';
import {
  Component,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Maximize2, Minimize2, MessageCircle, Sparkles, X } from 'lucide-react';
import type { AuthenticatedActor } from '@nora/contracts';
import { useSystemPreferences } from '@/components/system-preferences-provider';
import { useAccessActor } from '@/modules/iam/access-context';
import { assistantCopy as c } from '@/i18n/assistant-copy';
import styles from './floating-assistant.module.css';

const PreparedChat = dynamic(
  () =>
    import('./executive-workspace').then((module) => module.AssistantComposer),
  { ssr: false },
);

class ChatBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function assistantScopeKey(
  actor: Pick<AuthenticatedActor, 'userId' | 'branchIds' | 'permissions'>,
) {
  return JSON.stringify([
    actor.userId,
    [...actor.branchIds].sort(),
    [...actor.permissions].sort(),
  ]);
}

function AssistantSession() {
  const { language } = useSystemPreferences();
  const english = language === 'en';
  const t = (text: readonly [string, string]) => text[english ? 1 : 0];
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (open) closeButton.current?.focus();
  }, [open]);
  const close = () => {
    setOpen(false);
    setExpanded(false);
    launcher.current?.focus();
  };
  return (
    <div className={styles.widget} dir={english ? 'ltr' : 'rtl'}>
      {hasOpened && (
        <section
          id={id}
          className={styles.panel}
          data-expanded={expanded}
          hidden={!open}
          role="dialog"
          aria-modal={false}
          aria-labelledby={id + '-title'}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              close();
            }
          }}
        >
          <header className={styles.header}>
            <span className={styles.avatar}>
              <Sparkles size={22} aria-hidden="true" />
            </span>
            <div className={styles.heading}>
              <h2 id={id + '-title'}>{t(c.widgetTitle)}</h2>
              <p>{t(c.widgetSubtitle)}</p>
            </div>
            <button
              type="button"
              className={styles.headerButton}
              onClick={() => setExpanded((value) => !value)}
              aria-label={t(expanded ? c.widgetRestore : c.widgetExpand)}
              title={t(expanded ? c.widgetRestore : c.widgetExpand)}
              aria-pressed={expanded}
              aria-controls={id}
            >
              {expanded ? (
                <Minimize2 size={18} aria-hidden="true" />
              ) : (
                <Maximize2 size={18} aria-hidden="true" />
              )}
            </button>
            <button
              ref={closeButton}
              type="button"
              className={styles.headerButton}
              onClick={close}
              aria-label={t(c.widgetClose)}
              title={t(c.widgetClose)}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <div className={styles.body}>
            <ChatBoundary
              fallback={
                <p className={styles.failure} role="alert">
                  {t(c.states.unavailable)}
                </p>
              }
            >
              <PreparedChat t={t} denied={false} english={english} floating />
            </ChatBoundary>
          </div>
        </section>
      )}
      <button
        ref={launcher}
        type="button"
        className={styles.launcher}
        aria-label={t(open ? c.widgetClose : c.widgetOpen)}
        title={t(open ? c.widgetClose : c.widgetOpen)}
        aria-expanded={open}
        aria-controls={hasOpened ? id : undefined}
        onClick={() => {
          if (open) close();
          else {
            setHasOpened(true);
            setOpen(true);
          }
        }}
      >
        {open ? (
          <X size={26} aria-hidden="true" />
        ) : (
          <MessageCircle size={28} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export function FloatingAssistant() {
  const actor = useAccessActor();
  return actor ? <AssistantSession key={assistantScopeKey(actor)} /> : null;
}
