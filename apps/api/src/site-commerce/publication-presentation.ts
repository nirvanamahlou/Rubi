import { BadRequestException } from '@nestjs/common';
export type WebsitePresentation = {
  title: string;
  description: string;
  commissionPercent: string;
  previewOnly?: boolean;
};
export function websitePresentation(value: unknown): WebsitePresentation {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('تنظیمات نمایش سایت معتبر نیست.');
  const v = value as Record<string, unknown>;
  if (
    typeof v.title !== 'string' ||
    v.title.length > 200 ||
    typeof v.description !== 'string' ||
    v.description.length > 5000 ||
    typeof v.commissionPercent !== 'string' ||
    !/^\d{1,3}(\.\d{1,4})?$/.test(v.commissionPercent) ||
    Number(v.commissionPercent) > 100 ||
    (v.previewOnly !== undefined && typeof v.previewOnly !== 'boolean')
  )
    throw new BadRequestException('تنظیمات نمایش سایت معتبر نیست.');
  return {
    title: v.title.trim(),
    description: v.description.trim(),
    commissionPercent: v.commissionPercent,
    ...(typeof v.previewOnly === 'boolean'
      ? { previewOnly: v.previewOnly }
      : {}),
  };
}
