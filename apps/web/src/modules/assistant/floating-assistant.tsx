'use client';

import dynamic from 'next/dynamic';
import {
  Component,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { MessageCircle, Sparkles, X } from 'lucide-react';
import type { AuthenticatedActor } from '@nora/contracts';
import { useSystemPreferences } from '@/components/system-preferences-provider';
import { useAccessActor } from '@/modules/iam/access-context';
import { assistantCopy as c } from '@/i18n/assistant-copy';
import styles from './floating-assistant.module.css';
import { useFloatingDrag } from './use-floating-drag';
import { resizeEdges } from './floating-resize';
import { useFloatingResize } from './use-floating-resize';
import {
  ChatTextSizeControls,
  CHAT_TEXT_DEFAULT,
} from './chat-text-size-controls';

const PreparedChat = dynamic(
  () =>
    import('./executive-workspace').then((module) => module.AssistantComposer),
  { ssr: false },
);

const resizeLabels = {
  n: ['بالا', 'top'],
  s: ['پایین', 'bottom'],
  e: ['راست', 'right'],
  w: ['چپ', 'left'],
  ne: ['بالا راست', 'top right'],
  nw: ['بالا چپ', 'top left'],
  se: ['پایین راست', 'bottom right'],
  sw: ['پایین چپ', 'bottom left'],
} as const;

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
  const [hasOpened, setHasOpened] = useState(false);
  const [textSize, setTextSize] = useState(CHAT_TEXT_DEFAULT);
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const id = useId();
  const drag = useFloatingDrag({ launcher, panel, open, english });
  const resizeEvents = useFloatingResize(panel, open);
  useEffect(() => {
    if (open) closeButton.current?.focus();
  }, [open]);
  const close = () => {
    setOpen(false);
    launcher.current?.focus();
  };
  return (
    <div
      className={styles.widget}
      dir={english ? 'ltr' : 'rtl'}
      style={drag.widgetStyle}
      data-dragging={drag.dragging || undefined}
    >
      {hasOpened && (
        <section
          ref={panel}
          id={id}
          className={styles.panel}
          style={
            { '--assistant-chat-font-size': `${textSize}px` } as CSSProperties
          }
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
            <ChatTextSizeControls
              value={textSize}
              onChange={setTextSize}
              english={english}
            />
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
          {resizeEdges.map((edge) => (
            <button
              key={edge}
              type="button"
              className={styles.resizeHandle}
              data-edge={edge}
              aria-label={
                english
                  ? `Resize chat: ${t(resizeLabels[edge])}`
                  : `تغییر اندازه چت: ${t(resizeLabels[edge])}`
              }
              aria-controls={id}
              {...resizeEvents(edge)}
            />
          ))}
        </section>
      )}
      <button
        ref={launcher}
        type="button"
        className={styles.launcher}
        aria-label={t(open ? c.widgetClose : c.widgetOpen)}
        title={`${t(open ? c.widgetClose : c.widgetOpen)} — ${t(c.widgetMoveHint)}`}
        aria-describedby={id + '-move-hint'}
        aria-expanded={open}
        aria-controls={hasOpened ? id : undefined}
        {...drag.launcherEvents}
        onClick={(event) => {
          if (drag.consumeClick(event.detail)) return;
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
      <span id={id + '-move-hint'} className={styles.moveHint}>
        {t(c.widgetMoveHint)}
      </span>
    </div>
  );
}

export function FloatingAssistant() {
  const actor = useAccessActor();
  return actor ? <AssistantSession key={assistantScopeKey(actor)} /> : null;
}
