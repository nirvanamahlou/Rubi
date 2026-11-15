import catalog from '../../../../../services/assistant/workbench-guides.json';

export const workbenchGuideCatalog = catalog;
export type WorkbenchGuideTopic = (typeof catalog.topics)[number];
export type WorkbenchGuideGoal = 'steps' | 'troubleshoot' | 'follow-up';
const normalize = (s: string) =>
  s
    .normalize('NFKC')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[‌ـ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
const followup =
  /^(?:بعدش(?: چی)?|بعدش چیکار کنم|مرحله بعد(?: چیه)?|ادامه بده|حالا چی|بیشتر توضیح بده)[؟?.! ]*$/;
const family = (topic: WorkbenchGuideTopic) =>
  topic.tab !== 'requests'
    ? topic.tab
    : topic.id.startsWith('leave') || topic.id === 'substitute'
      ? 'leave'
      : ['advance', 'attendance-correction'].includes(topic.id)
        ? topic.id
        : 'requests';
export function resolveWorkbenchGuide(
  message: string,
  tab?: string,
  previous?: string,
) {
  const text = normalize(message);
  const explicit = /میز\s*کار|مرخص|جانشین|مساعده|تردد|پیام رسان|یادداشت/.test(
    text,
  );
  if (/قرارداد|بیمه مسافر|رزرو/.test(text) && !explicit) return undefined;
  const goal: WorkbenchGuideGoal = followup.test(text)
    ? 'follow-up'
    : /چرا|خطا|نمی|نمیشه|نمیاد|گیر|رد شده|متوقف/.test(text)
      ? 'troubleshoot'
      : 'steps';
  if (goal === 'follow-up' && previous) {
    const topic = catalog.topics.find((t) => t.id === previous);
    if (topic) return { topic, goal };
  }
  const matches = catalog.topics
    .map((topic) => ({
      topic,
      score: Math.max(
        0,
        ...topic.aliases.map((alias) =>
          text.includes(normalize(alias))
            ? topic.id === 'home'
              ? 1
              : normalize(alias).length
            : 0,
        ),
      ),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  if (matches.length) {
    const top = matches[0]!;
    if (top.topic.id === 'home' && /قرارداد|رزرو|بیمه/.test(text))
      return undefined;
    const other = matches.find(
      (r) =>
        family(r.topic) !== family(top.topic) &&
        r.score > 1 &&
        !(
          r.topic.tab === 'requests' &&
          top.topic.tab === 'requests' &&
          [family(r.topic), family(top.topic)].includes('requests')
        ),
    );
    if (other && / و |همچنین/.test(text))
      return {
        goal,
        clarification: `درباره «${top.topic.title}» راهنمایی می‌خواهید یا «${other.topic.title}»؟`,
      };
    return { topic: top.topic, goal };
  }
  if (
    tab &&
    /^(?:اینجا|این بخش|این صفحه).*(?:چطور|چجور|راهنما|کار)/.test(text)
  ) {
    const topic = catalog.topics.find((t) => t.tab === tab);
    if (topic) return { topic, goal };
  }
  if (
    tab &&
    catalog.topics.some((t) => t.tab === tab) &&
    /چطور|چجور|چگونه|از کجا|راهنما/.test(text) &&
    !/فروش|درآمد|قرارداد|مطالبات|مبلغ/.test(text)
  ) {
    return {
      goal,
      clarification:
        'راهنمای کدام بخش میزکار من را می‌خواهید: درخواست‌ها و مرخصی، پیام‌ها، فایل‌ها، یادداشت‌ها، تقویم، عملکرد یا حساب و تنظیمات؟',
    };
  }
  return undefined;
}

export function renderWorkbenchGuide(
  topic: WorkbenchGuideTopic,
  goal: WorkbenchGuideGoal,
) {
  return [
    topic.title,
    `مسیر: ${topic.path.join(' ← ')}`,
    `مراحل:\n${topic.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}`,
    ...(goal === 'troubleshoot'
      ? [`اگر متوقف شدید:\n${topic.troubleshooting.join('\n')}`]
      : []),
    `محدودیت:\n${topic.limitations.join('\n')}`,
    `اقدام بعدی: ${topic.next}`,
    `منبع راهنما: ${topic.title} — نسخه ${catalog.version}`,
  ].join('\n\n');
}

/** Only catalog identifiers cross the model boundary. Never send the draft or history. */
export async function loadWorkbenchGuide(
  topic: WorkbenchGuideTopic,
  goal: WorkbenchGuideGoal,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  try {
    const response = await fetcher('/api/assistant/workbench-guide', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version: 1, topicId: topic.id, goal }),
      signal,
    });
    if (response.status === 401 || response.status === 403)
      throw new Error(`HTTP_${response.status}`);
    if (!response.ok) throw new Error('GUIDE_UNAVAILABLE');
    const body = await response.json();
    if (
      body.version !== 1 ||
      body.topicId !== topic.id ||
      body.goal !== goal ||
      !['model', 'internal'].includes(body.selection)
    )
      throw new Error('INVALID_GUIDE_RESPONSE');
    return renderWorkbenchGuide(topic, goal);
  } catch (error) {
    if (
      signal.aborted ||
      (error instanceof Error && /^HTTP_40[13]$/.test(error.message))
    )
      throw error;
    return renderWorkbenchGuide(topic, goal);
  }
}
