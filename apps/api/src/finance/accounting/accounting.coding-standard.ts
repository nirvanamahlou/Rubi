import type { AccountingAttributes } from '@nora/contracts';
import * as v from './accounting.validation';

// Names are the actual choices observed in CodingStandardPages/EditView.view.
const systemEntities = new Set([
  'گروه حساب',
  'شخص',
  'شرکت',
  'شعبه',
  'مرکز هزینه',
  'پروژه',
  'منبع تامین اعتبار',
  'دوره مالی',
  'کد',
  'طبقه خدمت',
  'حساب بانکی',
  'صندوق',
  'تنخواه',
  'تسهیلات مالی',
  'سفارشات',
  'قرارداد خرید',
  'مرکز نگهداری',
  'انبار',
  'طبقه',
  'کالا',
  'قرارداد فروش',
  'طبقه حساب مشتری',
  'طبقه حساب محصول',
  'بخش',
  'کانال فروش',
  'مرکز فروش',
  'ماهیت تسویه',
  'کانتر فروش',
  'حساب کل',
  'حساب معین',
]);

function rows(value: unknown): Record<string, unknown>[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(v.text(value, 16000) || '[]');
  } catch {
    v.invalid('ردیف‌های کدینگ استاندارد معتبر نیست.');
  }
  if (!Array.isArray(parsed) || parsed.length > 100)
    v.invalid('حداکثر صد ردیف مجاز است.');
  const seen = new Set<string>();
  return parsed.map((raw) => {
    const row = v.object(raw);
    const id = v.uuid(row.id)!.toLowerCase();
    if (seen.has(id)) v.invalid('شناسه ردیف تکراری است.');
    seen.add(id);
    return { ...row, id };
  });
}

/** Bounded, versioned metadata; never accepts source-owned built-in flags or
 * executable formula text through the generic configuration command. */
export function codingStandardAttributes(
  attributes: AccountingAttributes,
  previous?: AccountingAttributes,
): AccountingAttributes {
  if (
    Object.keys(attributes).some(
      (key) =>
        ![
          'protocolVersion',
          'entities',
          'extraFields',
          'notes',
          'isSystem',
        ].includes(key),
    )
  )
    v.invalid('فیلد کدینگ استاندارد معتبر نیست.');
  if (attributes.isSystem === true && previous?.isSystem !== true)
    v.rule('استاندارد پیش‌فرض توسط کاربر قابل ایجاد نیست.');
  if (previous?.isSystem === true) v.rule('استاندارد پیش‌فرض قابل تغییر نیست.');
  const entities = rows(attributes.entities).map((row) => {
    const systemEntity = v.text(row.systemEntity, 80);
    if (systemEntity && !systemEntities.has(systemEntity))
      v.invalid('موجودیت سیستمی معتبر نیست.');
    const detailReference = v.text(row.detailReference, 30, true);
    if (!['SYSTEM', 'STANDARD'].includes(detailReference))
      v.invalid('مرجع جزئیات معتبر نیست.');
    return {
      id: row.id,
      title: v.text(row.title, 160, true),
      titleEn: v.text(row.titleEn, 160),
      systemEntity,
      detailReference,
    };
  });
  const extraFields = rows(attributes.extraFields).map((row) => ({
    id: row.id,
    title: v.text(row.title, 160, true),
    value: v.text(row.value, 500),
    description: v.text(row.description, 500),
  }));
  return v.attributes({
    protocolVersion: v.text(attributes.protocolVersion, 80),
    entities: JSON.stringify(entities),
    extraFields: JSON.stringify(extraFields),
    ...(attributes.notes !== undefined ? { notes: attributes.notes } : {}),
    isSystem: false,
  });
}
