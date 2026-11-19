import { describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  loadWorkbenchGuide,
  renderWorkbenchGuide,
  resolveWorkbenchGuide,
  workbenchGuideCatalog,
} from './workbench-guides';
import { proxyAssistantConversation } from './proxy';

describe('vetted Workbench guidance', () => {
  it('clarifies an unknown Workbench procedure instead of sending it to the Sales SQL agent', () => {
    expect(
      resolveWorkbenchGuide('این گزینه کجاست؟', 'requests')?.clarification,
    ).toBeTruthy();
    for (const topic of workbenchGuideCatalog.topics)
      expect(resolveWorkbenchGuide(topic.title)?.topic?.id, topic.title).toBe(
        topic.id,
      );
    expect(
      resolveWorkbenchGuide('برای انجام این کار چطور اقدام کنم؟', 'requests')
        ?.clarification,
    ).toBeTruthy();
    expect(
      resolveWorkbenchGuide('فروش امروز چقدر است؟', 'requests'),
    ).toBeUndefined();
  });
  it('covers request deletion, note templates and calendar-native shortcuts without inventing workflows', () => {
    expect(resolveWorkbenchGuide('حذف درخواستم چطوره؟')?.topic?.id).toBe(
      'request-delete',
    );
    expect(
      resolveWorkbenchGuide('قالب یادداشت را چطور انتخاب کنم؟')?.topic?.id,
    ).toBe('note-templates');
    expect(
      resolveWorkbenchGuide('درخواست از تقویم چطور بزنم؟')?.topic?.id,
    ).toBe('calendar-request');
    expect(resolveWorkbenchGuide('تقویم هفتگی را باز کنم؟')?.topic?.id).toBe(
      'calendar-views',
    );
  });
  it('distinguishes notifications from notes and request approval from submission', () => {
    expect(resolveWorkbenchGuide('چطور مرخصی رو تایید کنم؟')?.topic?.id).toBe(
      'request-status',
    );
    expect(
      resolveWorkbenchGuide('جانشین مرخصی را چطور تایید کنم؟')?.topic?.id,
    ).toBe('substitute');
    expect(
      resolveWorkbenchGuide('مرخصی رو چجوری ساعتی ثبت کنم؟')?.topic?.id,
    ).toBe('leave-hourly');
    expect(resolveWorkbenchGuide('مرخصی رو چجوری لغو کنم؟')?.topic?.id).toBe(
      'request-delete',
    );
    expect(resolveWorkbenchGuide('مرخصی پیام')?.clarification).toBeTruthy();
    expect(
      resolveWorkbenchGuide('مرخصی و مساعده میخوام')?.clarification,
    ).toBeTruthy();
    expect(resolveWorkbenchGuide('نوتیف جدید کجاست؟')?.topic?.id).toBe(
      'notifications',
    );
    expect(resolveWorkbenchGuide('درخواست من چرا تایید نشده؟')?.topic?.id).toBe(
      'request-status',
    );
  });
  it('finds Call Center procedures from the panel and preserves the leave approval sequence', () => {
    expect(
      resolveWorkbenchGuide(
        'چطور نتیجه تماس بدون نتیجه را ثبت کنم؟',
        'call-center',
      )?.topic?.id,
    ).toBe('call-center-outcome');
    expect(
      resolveWorkbenchGuide('اینجا چطور کار می‌کند؟', 'call-center')?.topic?.id,
    ).toBe('call-center-overview');
    const leave = workbenchGuideCatalog.topics.find(
      (topic) => topic.id === 'leave-hourly',
    )!;
    expect(renderWorkbenchGuide(leave, 'steps')).toMatch(
      /مدیر واحد.*تأیید نهایی.*منابع انسانی/,
    );
  });
  it('covers all actual tabs with versioned sources, restrictions and no executable actions', () => {
    expect(workbenchGuideCatalog.version).toBe(1);
    expect(new Set(workbenchGuideCatalog.topics.map((t) => t.tab)).size).toBe(
      12,
    );
    for (const t of workbenchGuideCatalog.topics) {
      expect(t.href).toBe(
        t.tab === 'call-center'
          ? '/customer-affairs/call-center'
          : `/workbench?tab=${t.tab}`,
      );
      expect(t.steps.length).toBeGreaterThan(1);
      expect(t.conditions.length).toBeGreaterThan(0);
      for (const source of t.sources)
        expect(existsSync(resolve('../..', source)), source).toBe(true);
      expect(renderWorkbenchGuide(t, 'troubleshoot')).toContain(' ← ');
      expect(renderWorkbenchGuide(t, 'troubleshoot')).toContain(
        'اگر متوقف شدید',
      );
    }
  });
  it.each([
    ['چطور درخواست جدید بزنم؟', 'request-create'],
    ['چجوری مرخصی بگیرم؟', 'leave'],
    ['مرخصی ساعتی میخوام', 'leave-hourly'],
    ['مرخصی روزانه چطور بزنم', 'leave-daily'],
    ['برای استعلاجی چه کنم؟', 'leave-medical'],
    ['جانشینی را چطور قبول کنم؟', 'substitute'],
    ['اصلاح تردد چطوریه؟', 'attendance-correction'],
    ['مساعده میخوام', 'advance'],
    ['کارتابل کجاست؟', 'requests'],
    ['چرا درخواستم رد شده؟', 'request-status'],
    ['پیام بدم چجوری؟', 'messages'],
    ['فوروارد پیام چطوره؟', 'message-search'],
    ['ساخت گروه چطور انجام میشه؟', 'message-groups'],
    ['فایل های من کجاست؟', 'files'],
    ['یادداشت چطور بزنم؟', 'notes'],
    ['چک لیست چطور درست کنم؟', 'note-checklist'],
    ['بازگردانی یادداشت چطوره؟', 'note-organize'],
    ['مدارک مهم کجاست؟', 'favorites'],
    ['تقویم من چطور کار میکنه؟', 'calendar'],
    ['فعالیت های من یعنی چی؟', 'activities'],
    ['عملکرد من کجاست؟', 'performance'],
    ['چرا پورسانت نمیاد؟', 'performance-unavailable'],
    ['پکیج های روز کجاست؟', 'daily-packages'],
    ['پیشنهاد بدم چطور؟', 'feedback'],
    ['حساب و تنظیمات کجاست؟', 'account'],
    ['تغییر رمز چطوریه؟', 'password'],
    ['پیگیری خرید چطور انجام بدم؟', 'procurement'],
    ['گیرنده درخواست نمیاد', 'request-recipient'],
    ['خانه میزکار چیه؟', 'home'],
  ])('routes %s to %s', (question, id) =>
    expect(resolveWorkbenchGuide(question)?.topic?.id).toBe(id),
  );
  it('does not intercept Sales guides, SQL questions or unrelated records', () => {
    for (const q of [
      'چجور قرارداد بزنم؟',
      'تعداد قراردادهای شرکت چند است؟',
      'مبلغ قرارداد 120001 چقدر است؟',
      'از میزکار چجور قرارداد بزنم؟',
    ])
      expect(resolveWorkbenchGuide(q)).toBeUndefined();
  });
  it('retains a valid topic for follow-up, not arbitrary prior record content', () => {
    expect(
      resolveWorkbenchGuide('بعدش چی؟', undefined, 'leave-hourly')?.topic?.id,
    ).toBe('leave-hourly');
    expect(resolveWorkbenchGuide('بعدش چی؟')).toBeUndefined();
    expect(
      resolveWorkbenchGuide('اینجا چطور کار میکند؟', 'calendar')?.topic?.id,
    ).toBe('calendar');
    expect(
      resolveWorkbenchGuide('تقویم و پیام ها چطورند؟')?.clarification,
    ).toBeTruthy();
  });
  it('does not invent private reasons, unsupported financial balances or calendar time fields', () => {
    const t = workbenchGuideCatalog.topics.find(
      (t) => t.id === 'request-status',
    )!;
    expect(renderWorkbenchGuide(t, 'troubleshoot')).toContain(
      'علت واقعی رد یا توقف پرونده شما خوانده نشده',
    );
    expect(
      renderWorkbenchGuide(
        workbenchGuideCatalog.topics.find(
          (t) => t.id === 'performance-unavailable',
        )!,
        'steps',
      ),
    ).toContain('متصل نیستند');
    expect(
      renderWorkbenchGuide(
        workbenchGuideCatalog.topics.find((t) => t.id === 'calendar')!,
        'steps',
      ),
    ).toContain('ساعت مستقل');
  });
  it('sends only catalog identifiers, never question/history/employee data, and rejects model instructions', async () => {
    const topic = workbenchGuideCatalog.topics.find((t) => t.id === 'leave')!;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        version: 1,
        topicId: 'leave',
        goal: 'steps',
        selection: 'model',
        text: 'invented instructions',
      }),
    );
    const result = await loadWorkbenchGuide(
      topic,
      'steps',
      new AbortController().signal,
      fetcher,
    );
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]!.body))).toEqual({
      version: 1,
      topicId: 'leave',
      goal: 'steps',
    });
    expect(result).not.toContain('invented instructions');
    expect(result).toContain('ثبت و پیگیری درخواست');
  });
  it.each([429, 500, 503])(
    'answers internally when provider transport returns %s',
    async (status) => {
      const topic = workbenchGuideCatalog.topics[0]!;
      const f = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status }));
      expect(
        await loadWorkbenchGuide(
          topic,
          'steps',
          new AbortController().signal,
          f,
        ),
      ).toBe(renderWorkbenchGuide(topic, 'steps'));
    },
  );
  it.each([401, 403])(
    'never hides loss of authorization (%s) behind fallback',
    async (status) => {
      const f = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status }));
      await expect(
        loadWorkbenchGuide(
          workbenchGuideCatalog.topics[0]!,
          'steps',
          new AbortController().signal,
          f,
        ),
      ).rejects.toThrow(`HTTP_${status}`);
    },
  );
  it('never delivers a fallback after cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    const f = vi.fn<typeof fetch>().mockRejectedValue(new Error('aborted'));
    await expect(
      loadWorkbenchGuide(
        workbenchGuideCatalog.topics[0]!,
        'steps',
        controller.signal,
        f,
      ),
    ).rejects.toThrow();
  });
  it('uses the fixed authenticated guide endpoint and retains Origin checks', async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ version: 1 }));
    const request = (origin: string) =>
      new Request('https://erp.example/api/assistant/workbench-guide', {
        method: 'POST',
        headers: {
          origin,
          'content-type': 'application/json',
          cookie: 'nora_access=synthetic',
        },
        body: JSON.stringify({ version: 1, topicId: 'leave', goal: 'steps' }),
      });
    expect(
      (
        await proxyAssistantConversation(
          request('https://evil.example'),
          'http://127.0.0.1:4300',
          f,
          false,
          true,
        )
      ).status,
    ).toBe(403);
    expect(f).not.toHaveBeenCalled();
    expect(
      (
        await proxyAssistantConversation(
          request('https://erp.example'),
          'http://127.0.0.1:4300',
          f,
          false,
          true,
        )
      ).status,
    ).toBe(200);
    expect(String(f.mock.calls[0]![0])).toBe(
      'http://127.0.0.1:4300/v1/assistant/workbench-guide',
    );
  });
});
