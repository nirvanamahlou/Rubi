import {
  PAYROLL_COLUMNS,
  emptyPayrollRow,
  isPayrollInput,
  payrollCell,
  type PayrollRow,
} from '@nora/contracts';

/** Validate a paste as a unit and apply it only to displayed rows, never hidden employees. */
export function pastePayrollGrid(
  rows: PayrollRow[],
  visibleIds: string[],
  startId: string,
  startColumn: string,
  text: string,
  newId: () => string,
) {
  const start = visibleIds.indexOf(startId);
  const col = PAYROLL_COLUMNS.findIndex(([key]) => key === startColumn);
  const lines = text.replace(/\r/g, '').replace(/\n$/, '').split('\n');
  const additions = Math.max(0, start + lines.length - visibleIds.length);
  if (start < 0 || col < 0 || rows.length + additions > 500)
    throw new Error('حداکثر ۵۰۰ ردیف مجاز است.');
  const result = rows.map((row) => ({ ...row }));
  lines.forEach((line, offset) => {
    const id = visibleIds[start + offset];
    const index = id ? result.findIndex((row) => row.id === id) : -1;
    const row = index < 0 ? emptyPayrollRow(newId()) : result[index]!;
    line.split('\t').forEach((value, column) => {
      const key = PAYROLL_COLUMNS[col + column]?.[0];
      if (key && isPayrollInput(key)) row[key] = payrollCell(key, value);
    });
    if (index < 0) result.push(row);
  });
  return result;
}
