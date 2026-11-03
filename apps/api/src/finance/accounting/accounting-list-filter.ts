import type { AccountingAttributes } from '@nora/contracts';
import * as v from './accounting.validation';

const modes = ['all', 'any', 'not-all', 'none'];
const operators = [
  'contains',
  'not-contains',
  'equals',
  'not-equals',
  'starts',
  'empty',
  'not-empty',
  'before',
  'after',
];
const common = ['title', 'titleEn', 'description', 'code', 'active'];
const fields: Record<string, string[]> = {
  'fiscal-years': [
    ...common,
    'allocation.title',
    'allocation.code',
    'allocation.startDate',
    'allocation.endDate',
  ],
  ledgers: [...common, 'baseCurrency', 'isMain', 'allowsPosting'],
  'voucher-types': [...common, 'isDefault'],
};

/** Saved predicates are bounded data, never executable query expressions. */
export function listFilterAttributes(
  input: AccountingAttributes,
): AccountingAttributes {
  if (Object.keys(input).some((key) => !['listKind', 'filter'].includes(key)))
    v.invalid('اطلاعات فیلتر معتبر نیست.');
  const listKind = v.text(input.listKind, 40, true);
  if (!Object.hasOwn(fields, listKind)) v.invalid('فهرست معتبر نیست.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(v.text(input.filter, 16000, true));
  } catch {
    v.invalid('ساختار فیلتر معتبر نیست.');
  }
  let count = 0;
  const ids = new Set<string>();
  const visit = (
    raw: unknown,
    depth: number,
    allocationScope = false,
  ): Record<string, unknown> => {
    if (++count > 32 || depth > 6)
      v.invalid('تعداد یا عمق شرط‌ها بیش از حد مجاز است.');
    const node = v.object(raw);
    const id = v.text(node.id, 80, true);
    if (ids.has(id)) v.invalid('شناسه شرط تکراری است.');
    ids.add(id);
    if (node.type === 'group') {
      if (!modes.includes(String(node.mode)) || !Array.isArray(node.children))
        v.invalid('گروه شرط معتبر نیست.');
      if (
        node.scope !== undefined &&
        (node.scope !== 'allocations' ||
          listKind !== 'fiscal-years' ||
          allocationScope)
      )
        v.invalid('محدوده شرط معتبر نیست.');
      if (
        node.relationMode !== undefined &&
        !modes.includes(String(node.relationMode))
      )
        v.invalid('عملگر ارتباط معتبر نیست.');
      return {
        type: 'group',
        id,
        mode: node.mode,
        ...(node.scope
          ? { scope: node.scope, relationMode: node.relationMode ?? 'any' }
          : {}),
        children: (node.children as unknown[]).map((child) =>
          visit(
            child,
            depth + 1,
            allocationScope || node.scope === 'allocations',
          ),
        ),
      };
    }
    if (
      node.type !== 'rule' ||
      !fields[listKind]!.includes(String(node.field)) ||
      !operators.includes(String(node.operator)) ||
      !modes.includes(String(node.relationMode))
    )
      v.invalid('شرط معتبر نیست.');
    if (allocationScope && !String(node.field).startsWith('allocation.'))
      v.invalid('فیلد تخصیص معتبر نیست.');
    return {
      type: 'rule',
      id,
      field: node.field,
      operator: node.operator,
      relationMode: node.relationMode,
      value: v.text(node.value, 1000),
    };
  };
  const tree = visit(parsed, 0);
  if (tree.type !== 'group') v.invalid('ریشه فیلتر باید گروه باشد.');
  return { listKind, filter: JSON.stringify(tree) };
}
