import type { MasterDataRecord } from '@rubi/contracts';

export const mealServiceCodes = [
  'RO',
  'BB',
  'HB',
  'FB',
  'ALL',
  'UALL',
  'BRN',
] as const;
export const includedMealOptions = [
  'صبحانه',
  'ناهار',
  'شام',
  'یک وعده اصلی',
  'میان‌وعده',
  'تمام وعده‌ها',
  'نوشیدنی',
  'Room Service',
  'برانچ',
] as const;
export const mealServiceStatuses = [
  { value: 'active', label: 'فعال' },
  { value: 'inactive', label: 'غیرفعال' },
  { value: 'under_review', label: 'در حال بررسی' },
] as const;
export function mealServiceStatus(record?: MasterDataRecord) {
  return record?.attributes.isUnderReview === true
    ? 'under_review'
    : (record?.status ?? 'active');
}
export function parseIncludedMeals(value: string): string[] {
  const parsed: unknown = value.trim().startsWith('[')
    ? JSON.parse(value)
    : value
        .split(/[,،]/)
        .map((item) => item.trim())
        .filter(Boolean);
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string'))
    throw new Error('فهرست وعده‌ها معتبر نیست.');
  return [...new Set((parsed as string[]).map((item) => item.trim()))];
}
export function mealServiceFormValues(
  record?: MasterDataRecord,
): Record<string, string> {
  return {
    code: record?.code ?? '',
    name: record?.name ?? '',
    englishName: String(record?.attributes.englishName ?? ''),
    category: String(record?.attributes.category ?? 'MEAL_PLAN'),
    includedMeals: String(
      record?.attributes.includedMealsJson ??
        JSON.stringify(
          parseIncludedMeals(String(record?.attributes.includedMeals ?? '')),
        ),
    ),
    displayOrder: String(record?.attributes.displayOrder ?? '0'),
    status: mealServiceStatus(record),
  };
}
export function validateMealServiceForm(input: Record<string, string>) {
  const values = Object.fromEntries(
    Object.keys(mealServiceFormValues()).map((key) => [
      key,
      (input[key] ?? '').trim(),
    ]),
  );
  const errors: Record<string, string> = {};
  values.code = values.code!.toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(values.code))
    errors.code =
      'کد سرویس باید ۲ تا ۳۲ حرف لاتین، عدد، خط تیره یا زیرخط باشد.';
  if (!values.name || values.name.length > 160)
    errors.name = 'عنوان فارسی الزامی و حداکثر ۱۶۰ نویسه است.';
  if ((values.englishName?.length ?? 0) > 160)
    errors.englishName = 'عنوان انگلیسی حداکثر ۱۶۰ نویسه است.';
  if (!['MEAL_PLAN', 'SERVICE'].includes(values.category ?? ''))
    errors.category = 'دسته را انتخاب کنید.';
  if (!mealServiceStatuses.some((status) => status.value === values.status))
    errors.status = 'وضعیت را انتخاب کنید.';
  if (
    !/^\d+$/.test(values.displayOrder ?? '') ||
    Number(values.displayOrder) > 100000
  )
    errors.displayOrder = 'ترتیب نمایش باید عدد صحیح بین صفر تا ۱۰۰٬۰۰۰ باشد.';
  try {
    const meals = parseIncludedMeals(values.includedMeals ?? '');
    if (meals.length > 20 || meals.some((meal) => !meal || meal.length > 80))
      throw new Error();
    values.includedMeals = JSON.stringify(meals);
  } catch {
    errors.includedMeals = 'حداکثر ۲۰ وعده متنی با طول ۸۰ نویسه مجاز است.';
  }
  return { values, errors, success: Object.keys(errors).length === 0 };
}
export function mealServiceMutationValues(
  input: Record<string, string>,
  record?: MasterDataRecord,
) {
  const result = validateMealServiceForm(input);
  if (!result.success) throw new Error('فیلدهای وعده/سرویس را اصلاح کنید.');
  if (result.values.status === mealServiceStatus(record))
    delete result.values.status;
  if (record && result.values.code === record.code) delete result.values.code;
  return result.values;
}
