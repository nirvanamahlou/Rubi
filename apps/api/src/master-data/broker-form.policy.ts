import { BadRequestException } from '@nestjs/common';

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type BrokerLeaderDraft = {
  id?: string;
  version?: number;
  name: string;
  phone?: string;
};
export function brokerCityIds(value: unknown): string[] {
  const values = Array.isArray(value) ? value : String(value ?? '').split(',');
  const ids = [
    ...new Set(
      values
        .map(String)
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ];
  if (ids.length > 50 || ids.some((id) => !uuid.test(id)))
    throw new BadRequestException('حداکثر ۵۰ شهر معتبر انتخاب کنید.');
  return ids;
}
export function brokerLeaderDrafts(value: unknown): {
  items: BrokerLeaderDraft[];
  removed: { id: string; version: number }[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(value));
  } catch {
    throw new BadRequestException('اطلاعات تورلیدر معتبر نیست.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new BadRequestException('اطلاعات تورلیدر معتبر نیست.');
  const { items, removed } = parsed as Record<string, unknown>;
  if (
    !Array.isArray(items) ||
    !Array.isArray(removed) ||
    items.length + removed.length > 100
  )
    throw new BadRequestException('حداکثر ۱۰۰ تورلیدر مجاز است.');
  const seen = new Set<string>();
  function identity(entry: Record<string, unknown>, required: boolean) {
    if (entry.id === undefined && !required) return {};
    if (
      typeof entry.id !== 'string' ||
      !uuid.test(entry.id) ||
      !Number.isSafeInteger(entry.version) ||
      Number(entry.version) < 1 ||
      seen.has(entry.id)
    )
      throw new BadRequestException('شناسه یا نسخه تورلیدر معتبر نیست.');
    seen.add(entry.id);
    return { id: entry.id, version: Number(entry.version) };
  }
  return {
    items: items.map((item: unknown) => {
      if (!item || typeof item !== 'object' || Array.isArray(item))
        throw new BadRequestException('اطلاعات تورلیدر معتبر نیست.');
      const entry = item as Record<string, unknown>;
      const name = typeof entry.name === 'string' ? entry.name.trim() : '';
      if (!name || name.length > 160)
        throw new BadRequestException(
          'نام تورلیدر الزامی و حداکثر ۱۶۰ نویسه است.',
        );
      const key = identity(entry, false);
      if (entry.phone !== undefined && typeof entry.phone !== 'string')
        throw new BadRequestException('شماره تورلیدر معتبر نیست.');
      const phone =
        typeof entry.phone === 'string' ? entry.phone.trim() : undefined;
      if ((!key.id && !phone) || (phone !== undefined && !phone))
        throw new BadRequestException('شماره تورلیدر الزامی است.');
      return { ...key, name, ...(phone === undefined ? {} : { phone }) };
    }),
    removed: removed.map((entry: unknown) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry))
        throw new BadRequestException('حذف تورلیدر معتبر نیست.');
      return identity(entry as Record<string, unknown>, true) as {
        id: string;
        version: number;
      };
    }),
  };
}
