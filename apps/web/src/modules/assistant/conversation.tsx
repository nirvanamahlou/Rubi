'use client';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { assistantCopy as c, type AssistantText } from '@/i18n/assistant-copy';
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
  const t = (text: AssistantText) => text[english ? 1 : 0];
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
          ? c.conversationClarification[result.field][english ? 1 : 0]
          : t(c.conversationEvidence);
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
    <section aria-label={t(c.conversationLabel)}>
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
          aria-label={t(c.conversationMessage)}
          maxLength={4000}
          value={draft}
          disabled={busy}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" disabled={busy || !draft.trim()}>
          {t(c.conversationSend)}
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
          {t(c.conversationClear)}
        </button>
      </form>
      {failed && <p role="alert">{t(c.conversationUnavailable)}</p>}
    </section>
  );
}
