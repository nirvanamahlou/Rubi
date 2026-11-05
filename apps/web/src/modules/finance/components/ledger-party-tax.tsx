'use client';
import type { PersonTaxRow, LedgerTaxKind } from '@nora/contracts';
const taxLabels: Record<LedgerTaxKind, string> = {
  registered: 'مودی مشمول ثبت نام در نظام مالیاتی',
  article81: 'مشمولین حقیقی ماده ۸۱ ق.م.م',
  exempt: 'اشخاصی که ملزم به ثبت نام در نظام مالیاتی نیستند',
  consumer: 'مصرف کننده نهایی',
};
export function LedgerPartyTax({
  rows,
  onChange,
  company = false,
}: {
  rows: PersonTaxRow[];
  onChange: (rows: PersonTaxRow[]) => void;
  company?: boolean;
}) {
  const replace = (index: number, row: PersonTaxRow) =>
    onChange(rows.map((old, i) => (i === index ? row : old)));
  return (
    <fieldset>
      <legend>طرف معامله مالیاتی</legend>
      <table className="w-full">
        <thead>
          <tr>
            <th>نوع عملیات</th>
            <th>نوع طرف معامله مالیاتی</th>
            <th>حذف</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.operation}>
              <td>
                <select
                  aria-label="نوع عملیات"
                  value={row.operation}
                  onChange={(e) => {
                    const operation = e.target
                      .value as PersonTaxRow['operation'];
                    replace(i, {
                      operation,
                      kind:
                        operation === 'purchase' && row.kind === 'consumer'
                          ? 'registered'
                          : row.kind,
                    });
                  }}
                >
                  {(['purchase', 'sale'] as const).map((op) => (
                    <option
                      key={op}
                      value={op}
                      disabled={rows.some(
                        (r, n) => n !== i && r.operation === op,
                      )}
                    >
                      {op === 'purchase' ? 'خرید' : 'فروش'}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  aria-label="نوع طرف معامله مالیاتی"
                  value={row.kind}
                  onChange={(e) =>
                    replace(i, {
                      ...row,
                      kind: e.target.value as LedgerTaxKind,
                    })
                  }
                >
                  {(Object.keys(taxLabels) as LedgerTaxKind[])
                    .filter((k) =>
                      company
                        ? k === 'registered'
                        : row.operation === 'sale' || k !== 'consumer',
                    )
                    .map((k) => (
                      <option key={k} value={k}>
                        {taxLabels[k]}
                      </option>
                    ))}
                </select>
              </td>
              <td>
                <button
                  type="button"
                  aria-label="حذف ردیف مالیاتی"
                  onClick={() => onChange(rows.filter((_, n) => n !== i))}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        disabled={rows.length >= 2}
        onClick={() =>
          onChange([
            ...rows,
            {
              operation: rows.some((r) => r.operation === 'purchase')
                ? 'sale'
                : 'purchase',
              kind: 'registered',
            },
          ])
        }
      >
        ＋ افزودن ردیف
      </button>
    </fieldset>
  );
}
