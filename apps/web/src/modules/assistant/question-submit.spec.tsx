import { assistantCopy } from '@/i18n/assistant-copy';
import type * as ReactModule from 'react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Exercise the actual Composer event handlers with persistent hook state and
// mocked HTTP/DOM boundaries. This is not a live-browser/Groq acceptance test.
const h = vi.hoisted(() => ({
  values: [] as unknown[],
  cursor: 0,
  effects: [] as (() => void)[],
  path: '/sales',
  tab: '',
  key: '',
  company: 'company-a',
  user: 'user-a',
  permissions: ['sales.contracts.read.all'],
  fetcher: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useId: () => 'synthetic-composer',
  useState: (initial: unknown) => {
    const i = h.cursor++;
    if (!(i in h.values))
      h.values[i] =
        typeof initial === 'function' ? (initial as () => unknown)() : initial;
    return [
      h.values[i],
      (value: unknown) => {
        h.values[i] =
          typeof value === 'function'
            ? (value as (old: unknown) => unknown)(h.values[i])
            : value;
      },
    ];
  },
  useRef: (current: unknown) => {
    const i = h.cursor++;
    if (!(i in h.values)) h.values[i] = { current };
    return h.values[i];
  },
  useEffect: (effect: () => void, deps: unknown[]) => {
    const i = h.cursor++;
    const old = h.values[i] as unknown[] | undefined;
    if (!old || deps.some((value, j) => value !== old[j]))
      h.effects.push(effect);
    h.values[i] = deps;
  },
}));
vi.mock('next/navigation', () => ({
  usePathname: () => h.path,
  useSearchParams: () => new URLSearchParams(h.tab ? `tab=${h.tab}` : ''),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/modules/iam/access-context', () => ({
  useAccessActor: () => ({
    userId: h.user,
    branchIds: ['branch-a'],
    permissions: h.permissions,
  }),
  useAccessPermissions: () => [],
}));
vi.mock('@/modules/legal-entities/components/legal-entity-context', () => ({
  useLegalEntityContext: () => ({
    context: { selection: h.company, version: 1 },
  }),
}));
import { AssistantComposer } from './executive-workspace';
import { sourceUiText } from '@/i18n/source-text';

type Node = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object' || !('props' in value)) return [];
  const node = value as Node;
  return [node, ...nodes(node.props.children)];
}
function component(node: Node) {
  return (node.type as (props: Record<string, unknown>) => Node)(node.props);
}
function render(denied = false) {
  const scoped = component(
    AssistantComposer({ t: (text) => text[0], denied }) as Node,
  );
  if (h.key !== scoped.key) {
    h.values = [];
    h.key = String(scoped.key);
  }
  h.cursor = 0;
  const tree = component(scoped);
  for (const effect of h.effects.splice(0)) effect();
  return nodes(tree);
}
function chat() {
  return render()
    .filter((node) => node.props['data-role'] === 'assistant')
    .map((node) => {
      const content = (node.props.children as ReactModule.ReactNode[])[0];
      // PR1742 routes assistant text through the independently tested safe renderer.
      return content &&
        typeof content === 'object' &&
        'props' in content &&
        typeof (content.props as Record<string, unknown>).text === 'string'
        ? (content.props as { text: string }).text
        : sourceUiText(content);
    });
}
async function send(message: string) {
  const field = render().find((node) => node.type === 'textarea')!;
  (field.props.onChange as (event: unknown) => void)({
    target: { value: message },
  });
  const form = render().find((node) => node.type === 'form')!;
  (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
  await vi.waitFor(() => {
    const input = render().find((node) => node.type === 'textarea')!;
    const loading = render().some((node) => node.props.role === 'status');
    expect(loading).toBe(false);
    // Successful answers clear the draft; errors deliberately keep it.
    expect(input).toBeTruthy();
  });
}
const answer = () =>
  Response.json({
    version: 3,
    status: 'ANSWER',
    text: 'تعداد بر اساس شواهد تازه: ۷',
    plan: ['بررسی'],
    sources: [
      {
        resultId: '12345678-1234-4234-8234-123456789abc',
        sources: ['contracts'],
        observedAt: '2026-11-16T08:00:00Z',
        truncated: false,
      },
    ],
    limitations: [],
    requestId: '12345678-1234-4234-8234-123456789abd',
  });
beforeEach(() => {
  h.values = [];
  h.effects = [];
  h.key = '';
  h.path = '/sales';
  h.tab = '';
  h.company = 'company-a';
  h.user = 'user-a';
  h.permissions = ['sales.contracts.read.all'];
  vi.stubEnv('NEXT_PUBLIC_ASSISTANT_AGENT_ENABLED', 'true');
  vi.stubGlobal('document', { querySelector: () => null });
  vi.stubGlobal(
    'MutationObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  h.fetcher.mockReset().mockImplementation(async () => answer());
  vi.stubGlobal('fetch', h.fetcher);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('actual Composer submit routing and transport', () => {
  it.each(['/workbench', '/sales', '/finance/delivery'])(
    'clarifies the sales period and reads the same ERP report from %s',
    async (path) => {
      h.path = path;
      await send('مجموع فروش ماه اخیر رو بده');
      expect(h.fetcher).not.toHaveBeenCalled();
      expect(chat().at(-1)).toContain('۳۰ روز کامل گذشته');
      await send('۳۰ روز گذشته');
      expect(h.fetcher).toHaveBeenCalledOnce();
      const [url, init] = h.fetcher.mock.calls[0]!;
      expect(url).toBe('/api/assistant/v3/conversation');
      expect(JSON.parse(init.body).message).toBe('فروش 30 روز گذشته چقدر است؟');
    },
  );
  it('answers a supported HR aggregate through the authenticated ERP dashboard only', async () => {
    h.company = 'ALL';
    h.path = '/workbench';
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '/api/v1');
    h.fetcher.mockResolvedValueOnce(
      Response.json({
        version: 1,
        id: 'employee-overtime',
        range: 'week',
        scope: 'authorized',
        value: '۱۲٫۵',
      }),
    );
    await send('مجموع اضافه‌کاری کارکنان این هفته چقدره؟');
    expect(h.fetcher).toHaveBeenCalledOnce();
    const [url, init] = h.fetcher.mock.calls[0]!;
    expect(url).toMatch(/^\/api\/v1\/reports\/nora\/metric\?/u);
    expect(new URLSearchParams(url.split('?')[1]).get('id')).toBe(
      'employee-overtime',
    );
    expect(init.credentials).toBe('include');
    expect(chat()[0]).toContain('**۱۲٫۵ ساعت**');
  });

  it('also shows pending feedback immediately on the legacy v2 path and prevents a same-tick double send', async () => {
    vi.stubEnv('NEXT_PUBLIC_ASSISTANT_AGENT_ENABLED', 'false');
    let resolve!: (response: Response) => void;
    h.fetcher.mockImplementationOnce(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    const field = render().find((node) => node.type === 'textarea')!;
    (field.props.onChange as (event: unknown) => void)({
      target: { value: 'تعداد قراردادها چقدر است؟' },
    });
    const form = render().find((node) => node.type === 'form')!;
    const submit = form.props.onSubmit as (event: unknown) => void;
    submit({ preventDefault() {} });
    submit({ preventDefault() {} });
    await vi.waitFor(() => expect(h.fetcher).toHaveBeenCalledOnce());
    expect(h.fetcher.mock.calls[0]![0]).toBe('/api/assistant/v2/conversation');
    expect(
      render().filter((node) => node.props['data-role'] === 'user'),
    ).toHaveLength(1);
    expect(render().some((node) => node.props.role === 'status')).toBe(true);
    resolve(
      Response.json({
        version: 1,
        status: 'REPLY',
        text: 'سلام، پاسخ آزمایشی',
      }),
    );
    await vi.waitFor(() =>
      expect(chat()).toEqual([assistantCopy.internalSourceFallback[0]]),
    );
    expect(render().some((node) => node.props.role === 'status')).toBe(false);
  });
  it('shows the user message and pending indicator before HTTP finishes, without duplicate history or erasing the next draft', async () => {
    let resolve!: (response: Response) => void;
    h.fetcher.mockImplementationOnce(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    const field = render().find((node) => node.type === 'textarea')!;
    (field.props.onChange as (event: unknown) => void)({
      target: { value: 'تعداد قراردادها را بگو' },
    });
    const form = render().find((node) => node.type === 'form')!;
    (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
    await vi.waitFor(() => expect(h.fetcher).toHaveBeenCalledOnce());
    let tree = render();
    expect(
      tree.filter((node) => node.props['data-role'] === 'user'),
    ).toHaveLength(1);
    expect(chat()).toHaveLength(0);
    expect(tree.some((node) => node.props.role === 'status')).toBe(true);
    expect(tree.find((node) => node.type === 'textarea')!.props.value).toBe('');
    expect(JSON.parse(h.fetcher.mock.calls[0]![1].body).history).toEqual([]);
    (
      tree.find((node) => node.type === 'textarea')!.props.onChange as (
        event: unknown,
      ) => void
    )({ target: { value: 'پرسش بعدی' } });
    expect(h.fetcher.mock.calls[0]![1].signal.aborted).toBe(false);
    resolve(answer());
    await vi.waitFor(() => expect(chat()).toHaveLength(1));
    tree = render();
    expect(
      tree.filter((node) => node.props['data-role'] === 'user'),
    ).toHaveLength(1);
    expect(tree.some((node) => node.props.role === 'status')).toBe(false);
    expect(tree.find((node) => node.type === 'textarea')!.props.value).toBe(
      'پرسش بعدی',
    );
  });
  it('retains a failed user bubble but excludes it from future provider history', async () => {
    h.fetcher.mockResolvedValueOnce(Response.json({}, { status: 429 }));
    await send('تعداد قراردادها را بگو');
    expect(
      render().filter((node) => node.props['data-role'] === 'user'),
    ).toHaveLength(1);
    expect(render().some((node) => node.props.role === 'alert')).toBe(true);
    await send('جمع فروش را بگو');
    expect(JSON.parse(h.fetcher.mock.calls[1]![1].body).history).toEqual([]);
    expect(
      render().filter((node) => node.props['data-role'] === 'user'),
    ).toHaveLength(2);
  });
  it('switches from Sales data to local linked Workbench guidance without a provider call', async () => {
    await send('تعداد قراردادها را بگو');
    await send('چطور مرخصی ساعتی ثبت کنم؟');
    expect(h.fetcher).toHaveBeenCalledTimes(1);
    expect(chat().at(-1)).toContain('مرخصی');
    expect(chat().at(-1)).not.toContain('شواهد تازه');
    const links = render().map((node) => node.props.href);
    expect(links).toContain('/assistant-guides/workbench#leave-hourly');
    expect(links).toContain('/workbench?tab=requests');
  });
  it('uses internal travel document guidance after a Sales data answer', async () => {
    await send('تعداد قراردادها را بگو');
    await send('رویه سند زدن بلیط هواپیما و هتل به چه صورت انجام میشود');
    expect(h.fetcher).toHaveBeenCalledTimes(1);
    expect(chat().at(-1)).toContain(
      'صدور و تحویل بلیت پرواز و واچر هتل در روبی',
    );
    expect(chat().at(-1)).toContain('وضعیت مجوز تحویل مدارک');
    const links = render().map((node) => node.props.href);
    expect(links).toContain('/assistant-guides/sales#travel-document-workflow');
    expect(links).toContain('/sales');
    await send('مرحله بعد چیه؟');
    expect(h.fetcher).toHaveBeenCalledTimes(1);
    expect(chat().at(-1)).toContain(
      'صدور و تحویل بلیت پرواز و واچر هتل در روبی',
    );
  });
  it.each(['REPLY', 'CLARIFY'])(
    'does not display unsourced v3 %s text',
    async (status) => {
      h.fetcher.mockResolvedValueOnce(
        Response.json({
          version: 3,
          status,
          text: 'Generic workflow with invented approval rules',
          plan: [],
          sources: [],
          limitations: ['Invented additional condition'],
          requestId: '12345678-1234-4234-8234-123456789abd',
        }),
      );
      await send('تعداد قراردادها را بگو');
      expect(h.fetcher).toHaveBeenCalledOnce();
      expect(chat()).toEqual([assistantCopy.internalSourceFallback[0]]);
    },
  );
  it('keeps unsupported workflow questions local', async () => {
    await send('چطور فرایند ناشناخته را انجام بدهم؟');
    expect(h.fetcher).not.toHaveBeenCalled();
    expect(chat().at(-1)).toContain('کدام فرایند، پرونده یا گزارش روبی');
  });
  it('does not reuse data context after an authorization denial', async () => {
    await send('تعداد قراردادها را بگو');
    h.fetcher.mockResolvedValueOnce(Response.json({}, { status: 403 }));
    await send('از کجا آوردی؟');
    expect(chat()).toHaveLength(0);
    await send('از کجا آوردی؟');
    expect(h.fetcher).toHaveBeenCalledTimes(2);
    expect(chat().at(-1)).toContain('کدام پاسخ');
  });
  it('keeps numeric objections on v3 after page/tab navigation, then switches explicitly to a receipt guide', async () => {
    await send('تعداد قراردادها را بگو');
    h.path = '/workbench';
    h.tab = 'files';
    render();
    await send('از کجا آوردی؟');
    expect(h.fetcher).toHaveBeenCalledTimes(2);
    expect(
      h.fetcher.mock.calls.every(
        ([url]) => url === '/api/assistant/v3/conversation',
      ),
    ).toBe(true);
    const payload = JSON.parse(h.fetcher.mock.calls[1]![1].body);
    expect(payload.message).toContain('تعداد قراردادها را بگو');
    expect(payload.history).toHaveLength(2);
    await send('از کجا رسید پرداخت بارگذاری کنم؟');
    expect(h.fetcher).toHaveBeenCalledTimes(2);
    expect(chat().at(-1)).toContain('بارگذاری و پیگیری رسید پرداخت');
  });
  it('does not match پرسیدم to receipt and clarifies why without prior evidence', async () => {
    await send('چرا؟');
    expect(h.fetcher).not.toHaveBeenCalled();
    h.fetcher.mockResolvedValueOnce(Response.json({ status: 'unmatched' }));
    await send('پرسیدم چجور قرارداد بزنم؟');
    expect(h.fetcher.mock.calls.map(([url]) => url)).toEqual([
      '/api/assistant/v3/guidance',
    ]);
    expect(chat().at(-1)).toContain('مراحل ثبت قرارداد جدید');
    expect(chat().at(-1)).not.toContain('بارگذاری و پیگیری رسید');
  });
  it('shows both data and grounded correction guidance, but never replaces failed data with guidance', async () => {
    await send('این مبلغ قرارداد از کجا آمده و از کجا اصلاحش کنم؟');
    expect(h.fetcher).toHaveBeenCalledOnce();
    expect(chat().at(-1)).toContain('شواهد تازه');
    expect(chat().at(-1)).toContain('اصلاح');
    const before = chat().length;
    h.fetcher.mockResolvedValueOnce(
      Response.json(
        { error: { code: 'AGENT_PROVIDER_RATE_LIMITED' } },
        { status: 429 },
      ),
    );
    await send('این مبلغ قرارداد از کجا آمده و از کجا اصلاحش کنم؟');
    expect(chat()).toHaveLength(before);
  });
  it.each(['company', 'user'])(
    'does not reuse a previous data subject after changing %s',
    async (field) => {
      await send('تعداد قراردادها را بگو');
      if (field === 'company') h.company = 'company-b';
      else h.user = 'user-b';
      render();
      await send('از کجا آوردی؟');
      expect(h.fetcher).toHaveBeenCalledOnce();
      expect(chat().at(-1)).toContain('کدام پاسخ');
    },
  );
  it('discards an in-flight response after navigation while preserving prior completed messages', async () => {
    await send('تعداد قراردادها را بگو');
    let resolve!: (response: Response) => void;
    h.fetcher.mockImplementationOnce(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    const field = render().find((node) => node.type === 'textarea')!;
    (field.props.onChange as (event: unknown) => void)({
      target: { value: 'از کجا آوردی؟' },
    });
    (
      render().find((node) => node.type === 'form')!.props.onSubmit as (
        event: unknown,
      ) => void
    )({ preventDefault() {} });
    await vi.waitFor(() => expect(h.fetcher).toHaveBeenCalledTimes(2));
    h.path = '/workbench';
    render();
    resolve(answer());
    await new Promise((done) => setTimeout(done, 0));
    expect(chat()).toHaveLength(1);
  });
});

describe('flight capacity guide in the Composer', () => {
  it('answers and continues from the catalogue without contacting the model', async () => {
    h.path = '/ticket-management';
    await send('چطور بلیط جدید تعریف کنم؟');
    expect(chat().at(-1)).toContain('رزرواسیون ← تعریف و ظرفیت پرواز');

    h.path = '/workbench';
    await send('بعدش چی؟');
    expect(chat().at(-1)).toContain('روز بعد');
    expect(h.fetcher).not.toHaveBeenCalled();
  });

  it('does not call the managed reader without the native management permission', async () => {
    h.path = '/ticket-management';
    await send('چند صندلی برای پرواز TK۱۲۳ در ۲۰۲۶-۱۲-۰۱ مانده؟');
    expect(chat().at(-1)).toContain('دسترسی مدیریت بلیط');
    expect(h.fetcher).not.toHaveBeenCalled();
  });
});

describe('Reservations catalogue in the Composer', () => {
  it('answers locally and continues after navigation without calling the model', async () => {
    h.path = '/reservations';
    await send('چطور خروجی مانیفست بگیرم؟');
    expect(chat().at(-1)).toContain('رزرواسیون ← MANIFEST');

    h.path = '/workbench';
    await send('بعدش چی؟');
    expect(chat().at(-1)).toContain('مسافر جامانده');
    expect(h.fetcher).not.toHaveBeenCalled();
  });

  it('drops the previous topic when the selected company changes', async () => {
    h.path = '/reservations';
    await send('چطور خروجی مانیفست بگیرم؟');
    expect(chat().at(-1)).toContain('MANIFEST');

    h.company = 'company-b';
    await send('بعدش چی؟');
    expect(chat().join('\n')).not.toContain('مسافر جامانده');
  });
});

describe('hotel purchase guide in the Composer', () => {
  const id = '12345678-1234-4234-8234-123456789abc';

  it('reads only the existing credentialed GET endpoint for an exact identifier', async () => {
    h.path = '/reservations/hotel-rates';
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '/api/v1');
    h.fetcher.mockResolvedValueOnce(
      Response.json({
        cityName: 'شهر آزمایشی',
        version: 2,
        checkIn: '2026-11-24',
        checkOut: '2026-11-26',
      }),
    );
    await send(`وضعیت این بسته ${id}`);
    expect(chat().at(-1)).toContain('نسخهٔ ذخیره‌شده: ۲');
    expect(h.fetcher).toHaveBeenCalledTimes(1);
    expect(h.fetcher).toHaveBeenCalledWith(
      `/api/v1/reservations/hotel-rates/packs/${id}`,
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(h.fetcher.mock.calls[0]?.[1]?.method).toBeUndefined();
  });

  it('reports a denied read without making a status claim', async () => {
    h.path = '/reservations/hotel-rates';
    h.fetcher.mockResolvedValueOnce(Response.json({}, { status: 403 }));
    await send(`وضعیت این بسته ${id}`);
    expect(chat().at(-1)).toContain('دسترسی این بخش برای حساب شما فعال نیست');
    expect(chat().at(-1)).not.toContain('نسخهٔ ذخیره‌شده:');
    expect(h.fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('System Management guide in the Composer', () => {
  it('answers across pages and retains the topic until company changes', async () => {
    h.permissions.push('system.audit.read');
    h.path = '/workbench';
    await send('فعالیت‌های قدیمی‌تر را در مدیریت سیستم از کجا ببینم؟');
    expect(chat().at(-1)).toContain('مدیریت سیستم ← تاریخچه');
    h.path = '/sales';
    await send('بعدش چی؟');
    expect(chat().at(-1)).toContain('نمای مجاز ERP');
    expect(h.fetcher).not.toHaveBeenCalled();
    h.company = 'company-b';
    await send('بعدش چی؟');
    expect(chat().join(' ')).not.toContain('مدیریت سیستم ← تاریخچه');
  });
  it('checks the History card permission and avoids the model', async () => {
    h.path = '/workbench';
    await send('تاریخچه فعالیت مدیریت سیستم رو از کجا ببینم؟');
    expect(chat().at(-1)).toContain('مجوز همان بخش مدیریت سیستم');
    expect(h.fetcher).not.toHaveBeenCalled();
  });
});

describe('Purchase guide depth in the Composer', () => {
  it('answers a floating ticket question locally from another page and follows up', async () => {
    h.path = '/workbench';
    await send('خرید بلیط شناور رو چطور ثبت کنم؟');
    expect(chat().at(-1)).toContain('خرید و تأمین ← بلیط شناور');
    await send('بعدش چی؟');
    expect(chat().at(-1)).toContain('ارز خرید');
    expect(h.fetcher).not.toHaveBeenCalled();
  });
});

describe('Sales panel catalogues in Composer', () => {
  it('switches between package workflows and continues without model calls', async () => {
    h.permissions.push('package_pricing.read');
    h.path = '/workbench';
    await send('بازه بستن پکیج رو کجا بررسی کنم؟');
    expect(chat().at(-1)).toContain('نرخ و بازه در بستن پکیج');
    await send('پیش نمایش قیمت شناور چطور باز میشه؟');
    expect(chat().at(-1)).toContain('هر دو پرواز');
    h.path = '/sales';
    await send('بعدش چی؟');
    expect(chat().at(-1)).toContain('هر دو پرواز');
    expect(h.fetcher).not.toHaveBeenCalled();
  });
  it('does not show marketing guidance without route access', async () => {
    h.path = '/workbench';
    await send('کمپین جدید چطور بسازم؟');
    expect(chat().at(-1)).not.toContain('تقویم');
    expect(h.fetcher).not.toHaveBeenCalled();
  });
});
