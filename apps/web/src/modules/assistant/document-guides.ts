import { documentsApi, DocumentsApiError } from '../documents/api/client';
import { containsQuestionPhrase, normalizeQuestion } from './question-text';

const root = '/documents';
const guide = (
  title: string,
  aliases: readonly string[],
  steps: string[],
  trouble: string,
  parent = '',
) => ({ title, aliases, steps, trouble, parent });

const guides = [
  guide(
    'نمای کلی',
    ['آرشیو اسناد', 'پنل اسناد', 'اسناد و فایل ها'],
    [
      'کارت‌های نمای کلی را برای مرور وضعیت بررسی کنید.',
      'برای جست‌وجوی دقیق یا بازکردن جزئیات، به «همه اسناد» یا دستهٔ مربوط بروید.',
    ],
    'بازه، شعبه و فیلترهای فهرست را کنترل کنید.',
  ),
  guide(
    'همه اسناد',
    ['جستجوی سند', 'جست وجوی سند', 'فیلتر سند', 'پیدا کردن سند'],
    [
      'عنوان یا کد آرشیو را جست‌وجو کنید. نوع، دسته، شعبه، اعتبار، تکمیل یا سایر فیلترهای نمایش‌داده‌شده را انتخاب کنید.',
      'با مرتب‌سازی و صفحه‌بندی نتیجه را پیدا کنید و جزئیات را باز کنید.',
    ],
    'فیلترها را پاک کنید و شعبه و دسترسی حساب را کنترل کنید.',
  ),
  ...(
    [
      ['مشتری و هویت', ['مدرک مشتری', 'مدارک هویتی'], 'پروندهٔ مشتری'],
      ['فروش و قرارداد', ['مدرک قرارداد', 'اسناد قرارداد'], 'پروندهٔ قرارداد'],
      [
        'سفر و رزرواسیون',
        ['مدرک مسافر', 'مدرک رزرواسیون'],
        'پروندهٔ سفر یا رزرواسیون',
      ],
      [
        'خرید و مالی',
        ['رسید قرارداد', 'مدرک مالی', 'سند خرید'],
        'پروندهٔ خرید یا مالی',
      ],
      [
        'سازمان و منابع انسانی',
        ['مدرک کارمند', 'اسناد منابع انسانی'],
        'پروندهٔ کارمند',
      ],
    ] as const
  ).map(([title, aliases, destination]) =>
    guide(
      title,
      aliases,
      [
        'نوع سند و شعبه را فیلتر کنید و با عنوان یا کد آرشیو جست‌وجو کنید.',
        `در جزئیات، ارتباط سند با ${destination} را تطبیق دهید. هنگام بارگذاری، از انتخاب‌گر «پرونده مربوطه» یا مسیر بارگذاری ماژول مبدأ استفاده کنید.`,
      ],
      'اگر پرونده در انتخاب‌گر نیست، نوع سند، شعبه و دسترسی به پروندهٔ مبدأ را بررسی کنید.',
    ),
  ),
  guide(
    'بارگذاری فایل',
    [
      'آپلود سند',
      'ثبت سند',
      'بارگذاری سند',
      'بارگذاری مدارک',
      'آپلود فایل',
      'فرمت فایل',
      'حجم فایل',
    ],
    [
      '«بارگذاری فایل» را بزنید. فایل، عنوان، نوع سند، دسته، فرستنده، شعبه و مالک را وارد کنید.',
      'محرمانگی، تاریخ اعتبار و پروندهٔ مرتبط را بر اساس نوع سند تنظیم کنید. پس از ثبت، وضعیت پردازش را در فهرست ببینید.',
    ],
    'فیلدهای الزامی، حجم و نوع مجاز برای سند انتخابی را بررسی کنید. تا پایان اسکن، پیش‌نمایش یا دانلود ممکن است در دسترس نباشد.',
  ),
  guide(
    'ثبت نسخه جدید',
    ['نسخه جدید', 'فایل جایگزین', 'جایگزینی فایل'],
    [
      'جزئیات همان سند را باز کنید و از اقدام «ثبت نسخه جدید» استفاده کنید.',
      'فایل جایگزین را بارگذاری کنید و سپس نسخهٔ جاری و وضعیت اسکن را در جزئیات تطبیق دهید.',
    ],
    'اگر اقدام موجود نیست، مجوز، وضعیت آرشیو و محدودیت‌های نوع سند را بررسی کنید.',
    'جزئیات سند',
  ),
  guide(
    'جزئیات سند',
    ['ویرایش سند', 'تاریخچه سند', 'اطلاعات سند'],
    [
      'سند را از فهرست باز کنید و اطلاعات، نسخه‌های فایل، ارتباط‌ها و زبانهٔ دسترسی را بررسی کنید.',
      'در صورت داشتن مجوز، از ویرایش اطلاعات یا تاریخچهٔ عملیات استفاده کنید.',
    ],
    'اگر سند هم‌زمان تغییر کرده، جزئیات را دوباره باز کنید و تغییرات جدید را بررسی کنید.',
    'همه اسناد',
  ),
  guide(
    'پیش‌نمایش و دانلود',
    [
      'پیش نمایش سند',
      'دانلود سند',
      'فایل باز نمیشه',
      'دانلود فایل',
      'کد محرمانگی',
      'اعتبارسنجی دومرحله ای',
    ],
    [
      'جزئیات را باز کنید و پیش‌نمایش یا «دانلود نسخه مجاز» را انتخاب کنید.',
      'در صورت درخواست، فرایند محرمانگی یا کد Authenticator را در خود پنل تکمیل کنید.',
    ],
    'مجوز فایل، پاک‌بودن اسکن، پشتیبانی فرمت و اعتبار مجوز کوتاه‌عمر را بررسی کنید. برای مجوز مصرف‌شده، فرایند را از همان پنل دوباره آغاز کنید.',
    'جزئیات سند',
  ),
  guide(
    'عملیات گروهی',
    ['انتخاب همه', 'گروهی', 'دسته جمعی'],
    [
      'ردیف‌ها را انتخاب کنید. گزینهٔ انتخاب همه، اسناد همین صفحه را انتخاب می‌کند.',
      'عملیات مجاز را از پنجرهٔ گروهی انجام دهید و نتیجهٔ موارد را بررسی کنید.',
    ],
    'بعد از نتیجهٔ جزئی فقط موارد ناموفق را پس از رفع علت دوباره انتخاب کنید.',
    'همه اسناد',
  ),
  guide(
    'مدارک ناقص و منقضی',
    ['مدرک ناقص', 'تمدید اعتبار', 'نزدیک انقضا', 'تکمیل مدرک', 'مدرک منقضی'],
    [
      'علامت ناقص و تاریخ اعتبار را جداگانه بررسی کنید.',
      'اطلاعات را ویرایش کنید، در صورت نیاز نسخهٔ جدید ثبت کنید و پس از رفع نقص، علامت تکمیل را مطابق اقدام پنل تغییر دهید.',
    ],
    'اگر تاریخ تمدید شده ولی سند هنوز ناقص است، علامت تکمیل و اطلاعات الزامی را بررسی کنید.',
  ),
  guide(
    'اشتراک‌گذاری‌ها',
    ['اشتراک گذاری سند', 'لینک سند', 'کپی لینک', 'اشتراک سند'],
    [
      'سند را در «اشتراک‌گذاری‌ها» پیدا کنید و لینک داخلی را کپی کنید.',
      'اگر کپی خودکار انجام نشد، لینک را از بخش «دسترسی و اشتراک» در جزئیات دستی کپی کنید.',
    ],
    'گیرنده باید وارد سامانه شود و مجوز دیدن سند را داشته باشد. لینک خود به‌تنهایی مجوز ایجاد نمی‌کند.',
  ),
  guide(
    'مدیریت آرشیو',
    ['بایگانی سند', 'حذف دائمی', 'آرشیو کردن سند'],
    [
      'از اقدامات ردیف یا جزئیات، بایگانی را انجام دهید. برای بازگرداندن از ابزار بازیابی استفاده کنید.',
      'حذف دائمی را فقط از اقدام مربوط و بعد از بررسی شرایط همان سند انجام دهید.',
    ],
    'مجوز جاری، وضعیت سند و توقف حقوقی را بررسی کنید.',
  ),
  ...(
    [
      [
        'مدارک ناقص و دسته‌بندی',
        'موارد ناقص را باز کنید، اطلاعات یا دسته را اصلاح کنید و سپس تکمیل را ثبت کنید.',
      ],
      [
        'اسناد تحت مسئولیت من',
        'فهرست محدود به اسنادی است که مالک آن‌ها حساب جاری است.',
      ],
      [
        'نگهداری و انقضا',
        'اسناد نزدیک انقضا را بررسی و اطلاعات اعتبار یا نسخه را از جزئیات به‌روز کنید.',
      ],
      [
        'بازیابی اسناد آرشیوشده',
        'سند آرشیوشده را پیدا و با مجوز بازیابی، آن را دوباره فعال کنید.',
      ],
    ] as const
  ).map(([title, step]) =>
    guide(
      title!,
      [],
      [step!],
      'پاک‌کردن فیلترهای اضافی، فیلتر پایهٔ این ابزار را حفظ می‌کند.',
      'مدیریت آرشیو',
    ),
  ),
  ...(
    [
      [
        'اسناد من',
        ['مالک فایل', 'سندهای من'],
        'اسنادی را ببینید که مالکشان شما هستید.',
      ],
      [
        'بارگذاری‌های من',
        ['فایل هایی که آپلود کردم'],
        'اسنادی را ببینید که نسخه‌ای از آن‌ها را شما بارگذاری کرده‌اید.',
      ],
      [
        'اخیراً دیده‌شده',
        ['آخرین سندهای دیده شده'],
        'به اسناد اخیراً بازشده برگردید.',
      ],
      [
        'علاقه‌مندی‌ها',
        ['ستاره سند', 'سند مورد علاقه'],
        'ستارهٔ ردیف را برای افزودن یا برداشتن علاقه‌مندی بزنید.',
      ],
    ] as const
  ).map(([title, aliases, step]) =>
    guide(
      title,
      aliases,
      [step],
      'فیلترها و دسترسی جاری را بررسی کنید. مالک فایل و بارگذار می‌توانند متفاوت باشند.',
      'نماهای شخصی',
    ),
  ),
];

export const documentGuideTopics = guides;
const generic =
  'موردی با این مشخصات در اسناد قابل مشاهده پیدا نشد. کد آرشیو، شعبه یا فهرست اسناد را بررسی کنید.';
const protectedDocument = (item: {
  confidentiality: string;
  requiresConfidentialAccessCode?: boolean;
}) =>
  ['CONFIDENTIAL', 'RESTRICTED'].includes(item.confidentiality) ||
  item.requiresConfidentialAccessCode;
const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

export function resolveDocumentQuestion(
  message: string,
  onPanel: boolean,
  previous?: string,
  selected?: string | null,
) {
  const question = normalizeQuestion(message);
  const code = question.match(
    /(?:^|\s)(doc-[a-z0-9]+(?:-[a-z0-9]+)*)(?=\s|$)/i,
  )?.[1];
  const link = message.match(
    /(?:https:\/\/[^/\s]+)?\/documents\?[^\s<>]+/,
  )?.[0];
  let id: string | null = null;
  const origin = globalThis.location?.origin ?? 'https://avinaofficial.ir';
  if (link) {
    const url = URL.parse(link, origin);
    if (url?.origin === origin && url.pathname === root)
      id = url.searchParams.get('document');
  }
  const panelTopic = /اسناد و فایل|پنل اسناد|آرشیو اسناد|کد آرشیو/.test(
    question,
  );
  const documentContext = /سند|مدرک/.test(question);
  const procedural = /چطور|چجور|چگونه|کجا|نحوه|راهنما|نمیشه|نمی شه/.test(
    question,
  );
  const status = /وضعیت|منقضی|ناقص|نسخه|مالک|دست کیه|اسکن|بایگانی/.test(
    question,
  );
  const title = message
    .match(/(?:سند|مدرک)\s*[«"]([^«»"\r\n]{2,120})[»"]/)?.[1]
    ?.trim();
  if (
    code ||
    (id && uuid.test(id)) ||
    ((onPanel || documentContext) && status && !procedural)
  ) {
    const target = id ?? (onPanel ? selected : null);
    if (code || title || (target && uuid.test(target)))
      return {
        kind: 'record' as const,
        code,
        title,
        id: target && uuid.test(target) ? target : undefined,
      };
    if (documentContext || (onPanel && /وضعیت|دست کیه/.test(question)))
      return {
        kind: 'clarify' as const,
        text: 'برای بررسی سند، کد آرشیو، لینک داخلی یا عنوان سند را داخل «» بنویسید.',
      };
  }
  const matched = guides
    .flatMap((topic) =>
      [topic.title, ...topic.aliases]
        .filter((alias) => containsQuestionPhrase(question, alias))
        .filter(
          (alias) =>
            onPanel ||
            panelTopic ||
            documentContext ||
            normalizeQuestion(alias) === question,
        )
        .map((alias) => ({ topic, score: normalizeQuestion(alias).length })),
    )
    .sort((a, b) => b.score - a.score)[0]?.topic;
  const continuation = /^(?:بعدش چی|بعدش|ادامه بده|مرحله بعد چیه)$/.test(
    question,
  );
  const topic =
    (continuation && guides.find((item) => item.title === previous)) ||
    matched ||
    ((onPanel || panelTopic) && /راهنما|این صفحه|اینجا/.test(question)
      ? guides[0]
      : undefined);
  if (topic) return { kind: 'guide' as const, topic, continuation };
  if (onPanel && documentContext && (procedural || status))
    return {
      kind: 'clarify' as const,
      text: 'نام بخش یا اقدام را بگویید؛ برای نمونه بارگذاری، پیش‌نمایش، نسخهٔ جدید، اشتراک یا بازیابی.',
    };
  if (!onPanel && procedural && /فایل من|فایلم/.test(question))
    return {
      kind: 'clarify' as const,
      text: 'منظورتان فایل در «اسناد و فایل‌ها»، «میزکار من» یا پیوست مکاتبه است؟',
    };
}

export function renderDocumentGuide(
  topic: (typeof guides)[number],
  continuation: boolean,
) {
  return [
    ['اسناد و گزارش‌ها', 'اسناد و فایل‌ها', topic.parent, topic.title]
      .filter(Boolean)
      .join(' ← '),
    ...(continuation
      ? [topic.steps.at(-1)]
      : topic.steps.map((step, i) => `${i + 1}. ${step}`)),
    topic.trouble,
  ].join('\n');
}

const scanLabels = {
  PENDING_SCAN: 'در انتظار اسکن',
  CLEAN: 'پاک',
  INFECTED: 'آلوده',
  SCAN_FAILED: 'اسکن ناموفق',
  QUARANTINED: 'قرنطینه',
  AWAITING_ANTIVIRUS_ADAPTER: 'در انتظار سرویس اسکن',
};
const archiveLabels = {
  ACTIVE: 'فعال',
  ARCHIVED: 'آرشیوشده',
  DELETED: 'حذف‌شده',
};

export async function readDocumentGuide(
  intent: Extract<
    ReturnType<typeof resolveDocumentQuestion>,
    { kind: 'record' }
  >,
  api: Pick<typeof documentsApi, 'list' | 'detail'> = documentsApi,
  now = Date.now(),
) {
  const key = intent.code ?? intent.title;
  const lookup = key
    ? await api.list({ search: key, isIncomingLetter: false, pageSize: 10 })
    : undefined;
  const matches = lookup?.data.filter(
    (item) =>
      !protectedDocument(item) &&
      (intent.code
        ? item.archiveCode.toLowerCase() === intent.code
        : normalizeQuestion(item.title).includes(normalizeQuestion(key!))),
  );
  if (
    !intent.code &&
    lookup &&
    (lookup.meta.totalPages > 1 || (matches?.length ?? 0) > 1)
  )
    return {
      text: 'برای تعیین سند دقیق، کد آرشیو یا لینک داخلی آن را از فهرست اسناد بفرستید.',
      href: root,
    };
  const id = key ? matches?.[0]?.id : intent.id;
  if (!id) return { text: generic, href: root };
  const result = await api.detail(id).catch((error: unknown) => {
    if (error instanceof DocumentsApiError && [403, 404].includes(error.status))
      return undefined;
    throw error;
  });
  if (!result) return { text: generic, href: root };
  const { data } = result;
  if (
    protectedDocument(data) ||
    data.isIncomingLetter ||
    data.archiveStatus === 'DELETED'
  )
    return { text: generic, href: root };
  const expiry = data.validUntil ? Date.parse(data.validUntil) : NaN;
  const validity = Number.isFinite(expiry)
    ? `${new Date(expiry).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' })} (${expiry < now ? 'منقضی' : 'معتبر'})`
    : 'تاریخ ثبت نشده';
  return {
    text: [
      `کد آرشیو ${data.archiveCode}`,
      `وضعیت سند ${archiveLabels[data.archiveStatus]} · ${data.isIncomplete ? 'ناقص' : 'کامل'}`,
      `نسخهٔ جاری ${data.currentVersion.versionNumber} · اسکن ${scanLabels[data.currentVersion.scanStatus]}`,
      `اعتبار ${validity}`,
      `مالک ثبت‌شده ${data.owner.displayName}`,
    ].join('\n'),
    href: `${root}?document=${encodeURIComponent(data.id)}`,
  };
}
