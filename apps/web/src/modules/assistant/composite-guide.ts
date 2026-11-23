import { assistantGuideCatalogues } from './assistant-guide-registry';
import { normalizeQuestion } from './question-text';

const leaveTypes = [
  { id: 'leave-hourly', match: /ساعتی/ },
  { id: 'leave-daily', match: /روزانه/ },
  { id: 'leave-medical', match: /استعلاجی/ },
];

function isSalesChecklist(question: string) {
  return (
    /(?:قبل|پیش) از ارسال/.test(question) &&
    /پرواز|بلی[تط]/.test(question) &&
    /هتل|اقامت/.test(question) &&
    /چک|بررسی|بازبینی|کنترل/.test(question) &&
    !/\p{N}/u.test(question)
  );
}

export function retrieveCompositeGuides(
  question: string,
  domain?: 'sales' | 'workbench',
) {
  const normalized = normalizeQuestion(question);
  if (domain === 'sales' && isSalesChecklist(normalized)) {
    return ['flight', 'hotel', 'review'].flatMap((id) =>
      assistantGuideCatalogues.sales.topics.filter((topic) => topic.id === id),
    );
  }
  if (
    domain === 'workbench' &&
    /از کجا.*پی[ ]?گیری/.test(normalized) &&
    !/وضعیت|الان|دست کی|تایید شده|تأیید شده/.test(normalized)
  ) {
    const types = leaveTypes.filter(({ match }) => match.test(normalized));
    if (types.length === 1) {
      return [types[0]!.id, 'leave-approval'].flatMap((id) =>
        assistantGuideCatalogues.workbench.topics.filter(
          (topic) => topic.id === id,
        ),
      );
    }
  }
  return [];
}

export async function selectCompositeChecklist(
  question: string,
  signal: AbortSignal,
) {
  if (!isSalesChecklist(normalizeQuestion(question))) return null;
  try {
    const response = await fetch('/api/assistant/workbench-guide', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version: 2, question }),
      signal,
    });
    if (!response.ok) return null;
    const data: { version?: number; selected?: Record<string, number[]> } =
      await response.json();
    return data.version === 2 ? (data.selected ?? null) : null;
  } catch {
    return null;
  }
}
