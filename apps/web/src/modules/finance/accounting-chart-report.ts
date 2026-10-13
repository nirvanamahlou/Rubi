import type {
  AccountingAccountV1,
  AccountingSnapshotV1,
} from '@nora/contracts';
import { detailTypeIds } from './accounting-chart-form';

export type ChartReportFormat =
  'GROUP' | 'GENERAL' | 'SUBSIDIARY' | 'STRUCTURAL';
export type ChartReportStructure = 'accounts' | 'detail-types' | 'counterparts';
export const chartReportOptions = {
  GROUP: [
    ['titleEn', 'عنوان به زبان دوم', false],
    ['active', 'وضعیت', false],
    ['description', 'شرح', false],
  ],
  GENERAL: [
    ['titleEn', 'عنوان به زبان دوم', false],
    ['type', 'نوع', true],
    ['nature', 'ماهیت', true],
    ['active', 'وضعیت', false],
    ['description', 'شرح', false],
  ],
  SUBSIDIARY: [
    ['titleEn', 'عنوان به زبان دوم', false],
    ['type', 'نوع', true],
    ['nature', 'ماهیت', true],
    ['active', 'وضعیت', false],
    ['description', 'شرح', false],
    ['features', 'ویژگی', true],
    ['currency', 'ارز پایه', false],
    ['levels', 'تعداد سطوح', false],
    ['counterpart', 'حساب طرف مقابل', true],
    ['mapping', 'نگاشت به حساب', false],
    ['taxFeature', 'ویژگی مالیاتی', false],
    ['taxType', 'انواع حساب مالیاتی', false],
  ],
} as const;

export type ChartReportColumn = { key: string; title: string };
export type ChartReportRow = {
  id: string;
  depth: number;
  level: AccountingAccountV1['level'];
  values: Record<string, string>;
};
export type ChartReport = {
  columns: ChartReportColumn[];
  rows: ChartReportRow[];
};
export type ChartReportSelection = {
  format: ChartReportFormat;
  structure: ChartReportStructure;
  selected: string[];
};

export function orderedChart(
  accounts: AccountingAccountV1[],
): { account: AccountingAccountV1; depth: number }[] {
  const result: { account: AccountingAccountV1; depth: number }[] = [];
  const visited = new Set<string>();
  const ids = new Set(accounts.map((a) => a.id));
  const children = new Map<string | null, AccountingAccountV1[]>();
  for (const account of accounts) {
    const parent =
      account.parentId && ids.has(account.parentId) ? account.parentId : null;
    const list = children.get(parent) ?? [];
    list.push(account);
    children.set(parent, list);
  }
  for (const list of children.values())
    list.sort(
      (a, b) =>
        a.code.localeCompare(b.code, 'en', { numeric: true }) ||
        a.id.localeCompare(b.id),
    );
  const visit = (account: AccountingAccountV1, depth: number) => {
    if (visited.has(account.id)) return;
    visited.add(account.id);
    result.push({ account, depth });
    for (const child of children.get(account.id) ?? []) visit(child, depth + 1);
  };
  for (const root of children.get(null) ?? []) visit(root, 0);
  // Broken or cyclic legacy references must not silently omit a real account.
  for (const account of accounts)
    if (!visited.has(account.id)) visit(account, 0);
  return result;
}

export function createChartReport(
  book: AccountingSnapshotV1,
  selection: ChartReportSelection,
  targetAccounts: AccountingAccountV1[] = [],
): ChartReport {
  const accounts = book.accounts.filter((a) => a.bookId === book.book.id);
  const lookup = new Map(accounts.map((a) => [a.id, a]));
  const targets = new Map(targetAccounts.map((a) => [a.id, a]));
  const accountLabel = (id: unknown) => {
    const account = typeof id === 'string' ? lookup.get(id) : undefined;
    return account ? `${account.code} — ${account.title}` : '';
  };
  const typeLabel = (id: string) =>
    book.configurations.find(
      (c) =>
        c.id === id && c.bookId === book.book.id && c.kind === 'detail-types',
    )?.title ?? '';
  const base: ChartReportColumn[] = [
    { key: 'code', title: 'کد' },
    { key: 'title', title: 'عنوان' },
  ];
  const structural = selection.format === 'STRUCTURAL';
  const columns =
    selection.format === 'STRUCTURAL'
      ? selection.structure === 'detail-types'
        ? [
            ...base,
            ...[4, 5, 6].map((level) => ({
              key: `detail${level}`,
              title: `سطح ${level}`,
            })),
          ]
        : selection.structure === 'counterparts'
          ? [...base, { key: 'counterpart', title: 'حساب طرف مقابل' }]
          : base
      : [
          ...base,
          ...chartReportOptions[selection.format]
            .filter(([key]) => selection.selected.includes(key))
            .flatMap(([key, title]) =>
              key === 'features'
                ? [
                    { key: 'multiCurrency', title: 'ویژگی ارزی' },
                    { key: 'traceable', title: 'ویژگی پیگیری' },
                    { key: 'revaluable', title: 'تسعیر پذیر' },
                  ]
                : [
                    {
                      key,
                      title:
                        key === 'currency'
                          ? 'ارز پیش فرض'
                          : key === 'levels'
                            ? 'تعداد سطح'
                            : key === 'taxType'
                              ? 'انواع مالیاتی'
                              : title,
                    },
                  ],
            ),
        ];
  const rows = orderedChart(accounts)
    .filter(({ account }) => structural || account.level === selection.format)
    .filter(
      ({ account }) =>
        !structural ||
        selection.structure === 'accounts' ||
        (account.level === 'SUBSIDIARY' &&
          (selection.structure === 'counterparts'
            ? !!accountLabel(account.attributes.counterpartId)
            : [4, 5, 6].some((level) =>
                detailTypeIds(account.attributes, level as 4 | 5 | 6).some(
                  (id) => !!typeLabel(id),
                ),
              ))),
    )
    .map(({ account: a, depth }) => {
      const attr = a.attributes;
      const counterpart = accountLabel(attr.counterpartId);
      const type =
        attr.accountType === 'MEMORANDUM'
          ? 'انتظامی'
          : a.permanent
            ? 'دائم'
            : 'موقت';
      return {
        id: a.id,
        level: a.level,
        depth: structural ? depth : 0,
        values: {
          code: a.code,
          title: a.title,
          titleEn: a.titleEn ?? '',
          type,
          nature:
            a.nature === 'DEBIT'
              ? 'بدهکار'
              : a.nature === 'CREDIT'
                ? 'بستانکار'
                : 'مهم نیست',
          active: a.active ? 'فعال' : 'غیرفعال',
          multiCurrency: attr.multiCurrency === true ? 'دارد' : 'ندارد',
          traceable: attr.traceable === true ? 'دارد' : 'ندارد',
          revaluable: attr.revaluable === true ? 'دارد' : 'ندارد',
          description: a.description ?? '',
          features: [
            attr.traceable === true ? 'ویژگی پیگیری' : '',
            attr.multiCurrency === true ? 'ویژگی ارزی' : '',
            attr.revaluable === true ? 'تسعیر پذیر است' : '',
          ]
            .filter(Boolean)
            .join('، '),
          currency:
            typeof attr.defaultCurrency === 'string'
              ? attr.defaultCurrency
              : '',
          levels: String(
            Array.isArray(attr.detailLevels)
              ? new Set(
                  attr.detailLevels.filter((level) =>
                    ['4', '5', '6'].includes(level),
                  ),
                ).size
              : [4, 5, 6].filter(
                  (level) => detailTypeIds(attr, level as 4 | 5 | 6).length > 0,
                ).length,
          ),
          counterpart,
          // Cross-book target names are not guessed from IDs or copied from source data.
          mapping: (book.subsidiaryMappings ?? [])
            .filter(
              (m) => m.sourceAccountId === a.id && m.bookId === book.book.id,
            )
            .map((m) => {
              const target = targets.get(m.targetAccountId);
              return target
                ? `${target.code} — ${target.title}`
                : accountLabel(m.targetAccountId);
            })
            .filter(Boolean)
            .join('، '),
          taxFeature:
            attr.taxAccountKind === 'TAX'
              ? 'معین مالیاتی'
              : attr.taxAccountKind === 'TAXABLE'
                ? 'معین مالیات پذیر'
                : '',
          taxType: typeof attr.taxType === 'string' ? attr.taxType : '',
          ...Object.fromEntries(
            [4, 5, 6].map((level) => [
              `detail${level}`,
              detailTypeIds(attr, level as 4 | 5 | 6)
                .map(typeLabel)
                .filter(Boolean)
                .join('، '),
            ]),
          ),
        },
      };
    });
  return { columns, rows };
}
