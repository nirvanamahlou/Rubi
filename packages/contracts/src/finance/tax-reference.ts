export type TaxReferenceKind = 'CURRENCY' | 'REGION';
export type SeasonalLayout = 'CURRENCY' | 'REGION' | 'CURRENCY_REGION';
export type TaxCode = { code: string; title: string };
export type TaxOption = TaxCode & { id: string };
export type TaxMappingView = {
  release: { id: string; label: string } | null;
  entries: TaxOption[];
  sources: (TaxOption & { entryId: string | null })[];
};
export type SeasonalRow = {
  journalId: string;
  number: number | null;
  date: string;
  contractId: string | null;
  reference: string | null;
  kind: string;
  amount: string;
  currency: string;
  regionId: string | null;
  region: string | null;
  currencyTarget: (TaxCode & { version: string }) | null;
  regionTarget: (TaxCode & { version: string }) | null;
  missing: TaxReferenceKind[];
};
export type SeasonalPreview = {
  rows: SeasonalRow[];
  digest: string;
  regionOptions: TaxOption[];
  history: { id: string; approvedAt: string }[];
};

/** UTF-8 CSV. Codes remain text throughout import, including leading zeroes. */
export function parseTaxReferenceCsv(input: string): TaxCode[] {
  const fail = (line: number): never => {
    throw new Error(`ردیف نامعتبر در فایل مرجع: ${line}`);
  };
  const csv = input.replace(/^\uFEFF/, '');
  if (csv.length > 1024 * 1024)
    throw new Error('اندازه فایل مرجع بیش از یک مگابایت است.');
  const lines = csv.split(/\r\n|\n|\r/);
  if (lines.shift()?.trim().toLowerCase() !== 'code,title')
    throw new Error('سرستون فایل باید code,title باشد.');
  const result: TaxCode[] = [];
  const seen = new Set<string>();
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    const match =
      /^(?:"((?:[^"]|"")*)"|([^",]*)),(?:"((?:[^"]|"")*)"|([^",]*))$/.exec(
        line,
      );
    if (!match) return fail(index + 2);
    const field = (value: string | undefined) =>
      (value ?? '').replace(/""/g, '"').trim();
    const code = field(match[1] ?? match[2]),
      title = field(match[3] ?? match[4]);
    if (
      !code ||
      !title ||
      code.length > 80 ||
      title.length > 200 ||
      /[\p{Cc}\uFFFD]/u.test(code + title) ||
      seen.has(code)
    )
      return fail(index + 2);
    seen.add(code);
    result.push({ code, title });
  }
  if (!result.length) throw new Error('فهرست مرجع خالی است.');
  return result;
}
