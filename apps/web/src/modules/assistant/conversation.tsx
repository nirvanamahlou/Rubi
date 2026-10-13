'use client';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import {
  assistantFilteredActionSchema,
  type AssistantActionResult,
} from './model';
import styles from './executive-workspace.module.css';

export const conversationResponseSchema = z.discriminatedUnion('status', [
  z
    .object({
      version: z.literal(1),
      status: z.literal('CLARIFY'),
      field: z.enum([
        'ACTION',
        'DATE_RANGE',
        'ROUTE',
        'BRANCH',
        'COMPANY_UNAVAILABLE',
      ]),
    })
    .strict(),
  z
    .object({
      version: z.literal(1),
      status: z.literal('ANSWER'),
      action: z.enum([
        'daily-summary',
        'sales-analysis',
        'receivables-follow-up',
      ]),
      evidence: assistantFilteredActionSchema,
    })
    .strict()
    .refine((value) => value.action === value.evidence.action),
]);
const clarification = {
  ACTION: [
    'خلاصه امروز، تحلیل فروش یا مانده قراردادی را می‌خواهید؟',
    'Choose today’s summary, sales analysis or contractual balances.',
  ],
  DATE_RANGE: [
    'بازه تاریخ گزارش را مشخص کنید؛ حداکثر ۹۰ روز کامل گذشته.',
    'Choose up to 90 completed past days.',
  ],
  ROUTE: [
    'مبدأ و مقصد مسیر را از فیلترهای مجاز مشخص کنید.',
    'Choose an origin and destination from the available filters.',
  ],
  BRANCH: [
    'شعبه موردنظر را از شعب مجاز مشخص کنید.',
    'Choose an authorized branch.',
  ],
  COMPANY_UNAVAILABLE: [
    'فیلتر شرکت حقوقی هنوز منبع تأییدشده ندارد؛ از شعبه مجاز استفاده کنید.',
    'Legal-company filtering has no approved source yet; use an authorized branch.',
  ],
} as const;
type Message = { role: 'user' | 'assistant'; content: string };

/** Prepared UI only: mount after provider/data policy approval with a real identity/session key. */
export function AssistantConversation({
  enabled,
  sessionKey,
  english = false,
  onEvidence,
}: {
  enabled: boolean;
  sessionKey: string;
  english?: boolean;
  onEvidence: (evidence: AssistantActionResult) => void;
}) {
  // Key changes unmount all memory and abort pending work (logout/user/session switch).
  return enabled ? (
    <ConversationSession
      key={sessionKey}
      english={english}
      onEvidence={onEvidence}
    />
  ) : null;
}
function ConversationSession({
  english,
  onEvidence,
}: {
  english: boolean;
  onEvidence: (evidence: AssistantActionResult) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const send = async () => {
    if (!draft.trim() || busy) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setFailed(false);
    const message = draft.trim();
    const history = messages
      .slice(-12)
      .map((item) => ({ ...item, content: item.content.slice(0, 1000) }));
    try {
      const response = await fetch('/api/assistant/v2/conversation', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ version: 1, message, history }),
        signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) setMessages([]);
        throw Error('UNAVAILABLE');
      }
      const result = conversationResponseSchema.parse(await response.json());
      if (controller.signal.aborted) return;
      const answer =
        result.status === 'CLARIFY'
          ? clarification[result.field][english ? 1 : 0]
          : english
            ? 'The source-backed result is shown below.'
            : 'نتیجه مستند درخواست در پایین نمایش داده شد.';
      setMessages((previous) =>
        [
          ...previous,
          { role: 'user', content: message } as Message,
          { role: 'assistant', content: answer } as Message,
        ].slice(-12),
      );
      setDraft('');
      if (result.status === 'ANSWER') onEvidence(result.evidence);
    } catch {
      if (!controller.signal.aborted) setFailed(true);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  return (
    <section aria-label={english ? 'Conversation' : 'گفت‌وگو'}>
      <div aria-live="polite">
        {messages.map((message, index) => (
          <p key={index} dir="auto">
            {message.content}
          </p>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <textarea
          className={styles.composerInput}
          aria-label={english ? 'Message' : 'پیام'}
          maxLength={4000}
          value={draft}
          disabled={busy}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" disabled={busy || !draft.trim()}>
          {english ? 'Send' : 'ارسال'}
        </button>
        <button
          type="button"
          onClick={() => {
            pending.current?.abort();
            setMessages([]);
            setDraft('');
            setBusy(false);
            setFailed(false);
          }}
        >
          {english ? 'Clear conversation' : 'پاک‌کردن گفت‌وگو'}
        </button>
      </form>
      {failed && (
        <p role="alert">
          {english
            ? 'Conversation is unavailable. The fixed reports remain available.'
            : 'گفت‌وگو در دسترس نیست؛ گزارش‌های آماده همچنان قابل استفاده‌اند.'}
        </p>
      )}
    </section>
  );
}
