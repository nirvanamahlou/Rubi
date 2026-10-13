import { unzipWorkbook } from '@/modules/customers/model/customer-xlsx';
import type { AccountingLineV1, AccountingSnapshotV1 } from '@nora/contracts';

// Column labels from the empty Rahkaran journal exchange workbook.
export const accountingDocumentImportHeaders = [
  'ردیف کمکی',
  'شماره فرعی',
  'تاریخ',
  'شرح',
  'شرح به زبان دوم',
  'نمایش فیلدهای ارزی',
  'ردیف قلم',
  'کد معین',
  'حروف اختصاری ارز',
  'حروف اختصاری ارز مبنا',
  'شرح قلم',
  'شماره پیگیری',
  'تاریخ پیگیری',
  'تعداد',
  'شرح به زبان دوم قلم',
  'بدهکار',
  'بستانکار',
  'نرخ ارز',
  'نرخ تبدیل',
  'بدهکار ارزی',
  'بستانکار ارزی',
  'بدهکار ارز مبنا',
  'بستانکار ارز مبنا',
  ...Array.from({ length: 17 }, (_, index) => `سطح ${index + 4}`),
  'وضعیت مالیاتی',
  'نوع معامله',
  'کالا یا خدمت یا تکلیفی',
  'خرید یا فروش',
  'شماره شخص/شرکت',
  'مبلغ مالیات',
  'مبلغ عوارض',
  'ماهیت دوره',
  'مالیات غیر قابل استرداد',
  'عوارض غیر قابل استرداد',
] as const;
export const accountingBranchDocumentImportHeaders = [
  ...accountingDocumentImportHeaders.slice(0, 3),
  'کد شعبه',
  ...accountingDocumentImportHeaders.slice(3),
];

export function validateAccountingImportHeaders(
  headers: readonly string[],
  withBranch = false,
) {
  const normalized = headers.map((value) => value.trim());
  const expected = withBranch
    ? accountingBranchDocumentImportHeaders
    : accountingDocumentImportHeaders;
  if (
    normalized.length !== expected.length ||
    normalized.some((value, index) => value !== expected[index])
  )
    throw new Error('ستون‌های فایل باید با قالب سند حسابداری یکسان باشند.');
}

/** Reuses the bounded ZIP/CRC decoder only; no Customer data or services. */
export async function readAccountingDocumentWorkbook(
  file: File,
  withBranch = false,
): Promise<string[][]> {
  if (!/\.xlsx$/i.test(file.name) || file.size > 5 * 1024 * 1024)
    throw new Error('فایل XLSX با حجم حداکثر ۵ مگابایت انتخاب کنید.');
  const files = await unzipWorkbook(await file.arrayBuffer());
  const parse = (xml: string) => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length)
      throw new Error('ساختار XML فایل معتبر نیست.');
    return doc;
  };
  const sharedXml = files.get('xl/sharedStrings.xml');
  const shared = sharedXml
    ? Array.from(parse(sharedXml).getElementsByTagName('si')).map(
        (item) => item.textContent ?? '',
      )
    : [];
  const worksheet = files.get('xl/worksheets/sheet1.xml');
  if (!worksheet) throw new Error('برگه اول فایل پیدا نشد.');
  const sheet = parse(worksheet);
  const rows = Array.from(sheet.getElementsByTagName('row'));
  if (rows.length > 5001) throw new Error('حداکثر ۵۰۰۰ قلم قابل خواندن است.');
  const result = rows.map((row) => {
    const references = new Set<string>();
    const values = Array.from(
      {
        length: withBranch
          ? accountingBranchDocumentImportHeaders.length
          : accountingDocumentImportHeaders.length,
      },
      () => '',
    );
    for (const cell of Array.from(row.getElementsByTagName('c'))) {
      const reference = cell.getAttribute('r') ?? '';
      if (!/^[A-Z]+[1-9][0-9]*$/.test(reference))
        throw new Error('نشانی سلول معتبر نیست.');
      if (references.has(reference)) throw new Error('نشانی سلول تکراری است.');
      references.add(reference);
      const index =
        [...reference.replace(/[0-9]/g, '')].reduce(
          (total, character) => total * 26 + character.charCodeAt(0) - 64,
          0,
        ) - 1;
      const raw = cell.getElementsByTagName('v')[0]?.textContent ?? '';
      const type = cell.getAttribute('t');
      if (type === 's' && !/^(0|[1-9][0-9]*)$/.test(raw))
        throw new Error('نشانی متن مشترک سلول معتبر نیست.');
      const value =
        type === 's'
          ? shared[Number(raw)]
          : type === 'inlineStr'
            ? (cell.getElementsByTagName('is')[0]?.textContent ?? '')
            : raw;
      if (value === undefined || value.length > 2000)
        throw new Error('مقدار سلول معتبر نیست.');
      if (index >= values.length) {
        if (value) throw new Error('فایل ستون اضافی دارد.');
        continue;
      }
      values[index] = value;
    }
    return values;
  });
  if (!result.length) throw new Error('فایل خالی است.');
  validateAccountingImportHeaders(result[0]!, withBranch);
  return result.slice(1).filter((row) => row.some((value) => value.trim()));
}

export type ImportedAccountingDocument = {
  key: string;
  documentDate: string;
  periodId: string;
  description: string;
  auxiliaryNumber: string;
  descriptionEn: string;
  lines: AccountingLineV1[];
};
const digits = (value: string) =>
  value
    .trim()
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
const exactAmount = (value: string) => {
  const normalized = digits(value).replace(/٫/g, '.');
  if (!normalized) return '0';
  if (!/^\d{1,20}(\.\d{1,18})?$/.test(normalized))
    throw new Error('مبلغ باید عدد اعشاری بدون جداکننده یا نماد علمی باشد.');
  const [whole, fraction = ''] = normalized.split('.');
  const tail = fraction.replace(/0+$/, '');
  return BigInt(whole!).toString() + (tail ? `.${tail}` : '');
};
export function accountingImportDate(input: string): string {
  const value = digits(input);
  let candidate = value;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split('/');
    candidate = `${year}-${month}-${day}`;
  } else if (/^\d{4,6}$/.test(value)) {
    const serial = Number(value);
    if (serial < 61 || serial > 100000)
      throw new Error('تاریخ اکسل معتبر نیست.');
    candidate = new Date(Date.UTC(1899, 11, 30) + serial * 86400000)
      .toISOString()
      .slice(0, 10);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate))
    throw new Error('تاریخ باید میلادی و معتبر باشد.');
  const date = new Date(candidate + 'T00:00:00Z');
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== candidate
  )
    throw new Error('تاریخ معتبر نیست.');
  return candidate;
}

export function prepareAccountingDocumentImport(
  rows: readonly (readonly string[])[],
  book: AccountingSnapshotV1,
  stopAtFirstError: boolean,
  memorandum = false,
  branchCode?: string,
) {
  const documents = new Map<string, ImportedAccountingDocument>();
  const errors: { row: number; message: string }[] = [];
  const invalidKeys = new Set<string>();
  const positions = new Map<string, Set<number>>();
  const linePositions = new Map<AccountingLineV1, number>();
  for (const [index, input] of rows.entries()) {
    const raw =
      branchCode === undefined
        ? input
        : [...input.slice(0, 3), ...input.slice(4)];
    const at = (column: number) => raw[column]?.trim() ?? '';
    const key = at(0);
    try {
      if (!key) throw new Error('ردیف کمکی سند الزامی است.');
      if (
        branchCode !== undefined &&
        (!branchCode || digits(input[3] ?? '') !== digits(branchCode))
      )
        throw new Error('کد شعبه با شعبه مجاز دفتر جاری یکسان نیست.');
      if (raw.slice(26).some((value) => value.trim()) || at(13) || at(18))
        throw new Error(
          'سطوح بالاتر از ۶، تعداد، نرخ تبدیل یا اطلاعات مالیاتی این قلم هنوز متصل نیستند.',
        );
      const documentDate = accountingImportDate(at(2));
      const periods = book.periods.filter(
        (period) =>
          period.status === 'OPEN' &&
          period.startDate <= documentDate &&
          period.endDate >= documentDate,
      );
      if (periods.length !== 1)
        throw new Error('تاریخ سند در یک دوره باز قرار ندارد.');
      const account = book.accounts.filter(
        (account) =>
          account.code === digits(at(7)) &&
          account.active &&
          account.level === 'SUBSIDIARY',
      );
      if (account.length !== 1 && !(memorandum && !at(7)))
        throw new Error('کد معین فعال و یکتا پیدا نشد.');
      const position = Number(digits(at(6)));
      if (!Number.isSafeInteger(position) || position < 1)
        throw new Error('ردیف قلم معتبر نیست.');
      const seen = positions.get(key) ?? new Set<number>();
      if (seen.has(position))
        throw new Error('ردیف قلم در این سند تکراری است.');
      const details = [23, 24, 25].map((column) => {
        const code = digits(at(column));
        if (!code) return null;
        const found = book.details.filter(
          (detail) => detail.active && detail.code === code,
        );
        if (found.length !== 1)
          throw new Error(`تفصیلی سطح ${column - 19} فعال و یکتا پیدا نشد.`);
        return found[0]!.id;
      });
      const debit = exactAmount(at(15)),
        credit = exactAmount(at(16));
      if (
        (at(21) && exactAmount(at(21)) !== debit) ||
        (at(22) && exactAmount(at(22)) !== credit)
      )
        throw new Error('مبلغ ارز مبنا با مبلغ عملیاتی قلم متفاوت است.');
      if (at(9) && at(9) !== book.book.baseCurrency)
        throw new Error('ارز مبنا با ارز عملیاتی دفتر یکسان نیست.');
      const currency = at(8) || null;
      const rate = currency ? exactAmount(at(17)) : null;
      const now = new Date().toISOString();
      const snapshots = currency
        ? book.fxRates.filter(
            (snapshot) =>
              snapshot.status === 'APPROVED' &&
              snapshot.currency === currency &&
              snapshot.rate === rate &&
              snapshot.approverId &&
              snapshot.makerId !== snapshot.approverId &&
              snapshot.validFrom <= now &&
              snapshot.validTo >= now,
          )
        : [];
      if (currency && snapshots.length !== 1)
        throw new Error('نرخ معتبر و یکتای ارز پیدا نشد.');
      if (!currency && [17, 19, 20].some((column) => at(column)))
        throw new Error('اطلاعات ارزی بدون انتخاب ارز وارد شده است.');
      const foreignDebit = exactAmount(at(19)),
        foreignCredit = exactAmount(at(20));
      if (foreignDebit !== '0' && foreignCredit !== '0')
        throw new Error('قلم ارزی همزمان بدهکار و بستانکار است.');
      const doc: ImportedAccountingDocument = documents.get(key) ?? {
        key,
        documentDate,
        periodId: periods[0]!.id,
        description: at(3),
        auxiliaryNumber: at(1),
        descriptionEn: at(4),
        lines: [],
      };
      if (
        doc.documentDate !== documentDate ||
        doc.description !== at(3) ||
        doc.auxiliaryNumber !== at(1) ||
        doc.descriptionEn !== at(4)
      )
        throw new Error('اطلاعات سربرگ اقلام یک سند یکسان نیست.');
      if (
        doc.lines.length >= 500 ||
        (documents.size >= 100 && !documents.has(key))
      )
        throw new Error('حداکثر ۱۰۰ سند و ۵۰۰ قلم در هر سند مجاز است.');
      doc.lines.push({
        accountId: account[0]?.id ?? null,
        detail4Id: details[0]!,
        detail5Id: details[1]!,
        detail6Id: details[2]!,
        description: at(10),
        debit,
        credit,
        currency,
        rate,
        foreignAmount: currency
          ? foreignDebit === '0'
            ? foreignCredit
            : foreignDebit
          : null,
        fxSnapshotId: snapshots[0]?.id ?? null,
        attributes: {
          descriptionEn: at(14),
          trackingNumber: at(11),
          ...(at(12) ? { trackingDate: accountingImportDate(at(12)) } : {}),
        },
      });
      linePositions.set(doc.lines.at(-1)!, position);
      seen.add(position);
      positions.set(key, seen);
      documents.set(key, doc);
    } catch (error) {
      invalidKeys.add(key);
      errors.push({
        row: index + 2,
        message: error instanceof Error ? error.message : 'قلم معتبر نیست.',
      });
      if (stopAtFirstError) break;
    }
  }
  return {
    documents: [...documents.values()]
      .filter((document) => !invalidKeys.has(document.key))
      .map((document) => ({
        ...document,
        lines: document.lines.sort(
          (left, right) => linePositions.get(left)! - linePositions.get(right)!,
        ),
      })),
    errors,
  };
}
