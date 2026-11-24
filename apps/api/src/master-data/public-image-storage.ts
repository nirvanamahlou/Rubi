import { BadRequestException } from '@nestjs/common';
import { join } from 'node:path';

export function publicMasterDataImageRoot(storageRoot: string): string {
  return join(storageRoot, 'public-hotel-images');
}

export function uploadedMasterDataImageName(path: string): string {
  const match =
    /^\/api\/v1\/master-data\/hotel-images\/([a-f0-9]{64}\.webp)$/.exec(path);
  if (!match) throw new BadRequestException('عکس باید از فرم بارگذاری شود.');
  return match[1]!;
}

export function normalizeMasterDataImages(
  values: Record<string, unknown>,
  empty: string | null,
): void {
  for (const [key, max] of [
    ['sourceMainImage', 1],
    ['sourceGalleryImages', 6],
  ] as const) {
    if (!Object.hasOwn(values, key)) continue;
    const raw = values[key];
    if (raw !== null && typeof raw !== 'string')
      throw new BadRequestException('عکس باید از فرم بارگذاری شود.');
    const urls = (raw ?? '')
      .split('|')
      .map((value) => value.trim())
      .filter(Boolean);
    if (urls.length > max)
      throw new BadRequestException(
        'یک عکس اصلی و حداکثر ۶ عکس گالری مجاز است.',
      );
    const paths = urls.map((value) => {
      const path = URL.parse(value, 'https://avinaofficial.ir')?.pathname ?? '';
      return `/api/v1/master-data/hotel-images/${uploadedMasterDataImageName(path)}`;
    });
    values[key] = paths.length ? paths.join('|') : empty;
  }
}
