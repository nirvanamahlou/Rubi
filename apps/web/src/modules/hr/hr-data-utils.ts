import type { HrPreviewCell, HrPreviewDataset } from './hr-preview-data';

export const cellText = (cell: HrPreviewCell | undefined): string =>
  typeof cell === 'string' ? cell : (cell?.label ?? '');
export const normalizeHrText = (value: string) =>
  value
    .normalize('NFKC')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[۰-۹٠-٩]/g, (c) =>
      String(
        '۰۱۲۳۴۵۶۷۸۹'.includes(c)
          ? '۰۱۲۳۴۵۶۷۸۹'.indexOf(c)
          : '٠١٢٣٤٥٦٧٨٩'.indexOf(c),
      ),
    )
    .toLocaleLowerCase()
    .trim();
export const readCell = (
  data: HrPreviewDataset,
  row: readonly HrPreviewCell[],
  ...columns: string[]
) => {
  for (const column of columns) {
    const index = data.columns.indexOf(column);
    if (index >= 0 && cellText(row[index])) return cellText(row[index]);
  }
  return '';
};
export const recordKey = (data: HrPreviewDataset, index: number) =>
  data.recordIds?.[index] ?? cellText(data.rows[index]?.[0]);
export function subsetDataset(
  data: HrPreviewDataset,
  indexes: readonly number[],
): HrPreviewDataset {
  return {
    ...data,
    rows: indexes.map((index) => data.rows[index]!),
    ...(data.recordIds
      ? { recordIds: indexes.map((index) => data.recordIds![index]!) }
      : {}),
    ...(data.versions
      ? { versions: indexes.map((index) => data.versions![index]!) }
      : {}),
    ...(data.employeeIds
      ? {
          employeeIds: indexes.map((index) => data.employeeIds![index] ?? null),
        }
      : {}),
    ...(data.parentIds
      ? { parentIds: indexes.map((index) => data.parentIds![index] ?? null) }
      : {}),
  };
}
export function relatedIndexes(
  parent: HrPreviewDataset,
  parentIndex: number,
  child: HrPreviewDataset,
): number[] {
  const row = parent.rows[parentIndex];
  if (!row) return [];
  const parentId = recordKey(parent, parentIndex);
  const employeeId = parent.employeeIds?.[parentIndex];
  const person = readCell(
    parent,
    row,
    'کارمند',
    'نام و نام خانوادگی',
    'متقاضی',
  );
  const number = readCell(parent, row, 'شماره قرارداد');
  const period = readCell(parent, row, 'عنوان دوره', 'دوره', 'دوره حقوق');
  const day = readCell(parent, row, 'تاریخ کارکرد', 'تاریخ تردد');
  return child.rows.flatMap((item, index) => {
    if (child.parentIds?.[index])
      return child.parentIds[index] === parentId ? [index] : [];
    // Durable records must be explicitly linked; legacy labels never override a UUID.
    if (child.recordIds)
      return employeeId &&
        child.employeeIds?.[index] === employeeId &&
        !day &&
        !number &&
        !period
        ? [index]
        : [];
    const reference = readCell(
      child,
      item,
      'قرارداد مرجع',
      'قرارداد',
      'شماره قرارداد',
    );
    if (number) return reference === number ? [index] : [];
    if (period) {
      const target = readCell(child, item, 'دوره ارزیابی', 'دوره', 'دوره حقوق');
      return target &&
        normalizeHrText(period).replace('ارزیابی ', '') ===
          normalizeHrText(target).replace('ارزیابی ', '')
        ? [index]
        : [];
    }
    const childPerson = readCell(
      child,
      item,
      'کارمند',
      'متقاضی',
      'نام و نام خانوادگی',
    );
    if (!person || normalizeHrText(person) !== normalizeHrText(childPerson))
      return [];
    if (
      day &&
      normalizeHrText(day) !==
        normalizeHrText(
          readCell(child, item, 'تاریخ کارکرد', 'تاریخ تردد', 'تاریخ'),
        )
    )
      return [];
    return [index];
  });
}
