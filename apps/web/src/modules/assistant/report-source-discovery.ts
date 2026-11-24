import { normalizeQuestion } from './question-text';

export function reportSourceTopic(question: string) {
  const text = normalizeQuestion(question);
  const match =
    /^(?:برای (.+?) (?:کدام|چه) گزارش(?:ی)?(?: را ببینم| داریم| مناسب است)?|(?:منبع داده|گزارش مناسب برای) (.+?)(?: کجاست| چیست| چیه))$/u.exec(
      text,
    );
  return match?.[1] ?? match?.[2] ?? null;
}

type CatalogEntry = { code: string; title: string; producerStatus: string };

function isEntry(item: unknown): item is CatalogEntry {
  return (
    typeof item === 'object' &&
    item !== null &&
    'code' in item &&
    typeof item.code === 'string' &&
    'title' in item &&
    typeof item.title === 'string' &&
    'producerStatus' in item &&
    typeof item.producerStatus === 'string'
  );
}

export async function describeReportSources(
  topic: string,
  authorized: unknown,
) {
  if (!Array.isArray(authorized) || !authorized.every(isEntry))
    throw new Error('Invalid native report catalog');
  const terms = [
    ...new Set(
      normalizeQuestion(topic)
        .split(' ')
        .filter(
          (term) =>
            term.length > 1 &&
            ![
              'برای',
              'های',
              'میزان',
              'تعداد',
              'مجموع',
              'مبلغ',
              'داده',
              'گزارش',
              'ها',
              'به',
              'از',
              'در',
              'را',
              'بر',
              'اساس',
            ].includes(term),
        ),
    ),
  ];
  if (!terms.length)
    return 'نام موضوع گزارش را مشخص کنید؛ مثلاً اضافه‌کاری یا خرید از تأمین‌کننده.';
  const { reportCatalog } = await import('../reports/model/reporting');
  const ranked = authorized
    .filter((item) => item.producerStatus === 'READY')
    .map((item) => {
      const definition = reportCatalog.find(
        (report) => report.code === item.code,
      );
      const title = normalizeQuestion(item.title);
      const metadata = normalizeQuestion(
        [
          definition?.category,
          definition?.description,
          ...(definition?.dimensions ?? []),
          ...(definition?.measures ?? []),
        ].join(' '),
      );
      const words = terms.map((term) =>
        title.includes(term) ? 3 : metadata.includes(term) ? 1 : 0,
      );
      return {
        item,
        score: words.every(Boolean)
          ? words.reduce<number>((sum, n) => sum + n, 0)
          : 0,
      };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  if (!ranked.length)
    return 'در گزارش‌های متصل و قابل مشاهدهٔ شما گزارشی منطبق با این موضوع پیدا نشد.';
  return [
    'اسناد و گزارش‌ها ← گزارش‌ها',
    ...ranked.map(({ item }) => '• ' + item.title),
  ].join('\n');
}
