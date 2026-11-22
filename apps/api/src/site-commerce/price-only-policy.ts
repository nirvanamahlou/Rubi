import { ConflictException } from '@nestjs/common';

/** Floating products have a published price, but no website-reservable inventory. */
export function websitePriceOnly(kind: string, supplyType?: string | null) {
  return kind === 'floating-tour' || supplyType === 'FLOATING';
}

export function assertWebsiteBookable(
  kind: string,
  supplyType?: string | null,
) {
  if (websitePriceOnly(kind, supplyType))
    throw new ConflictException(
      'این محصول فقط برای نمایش قیمت است و رزرو اینترنتی ندارد.',
    );
}
