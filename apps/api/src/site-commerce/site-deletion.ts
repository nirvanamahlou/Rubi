import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Prisma } from '@nora/database';

type Subject = {
  branchId: string;
  kind: 'tour' | 'floating-tour' | 'ticket';
  resourceId: string;
};

export function publishedSites(tx: Prisma.TransactionClient, subject: Subject) {
  return tx.websitePublication.findMany({
    where: { ...subject, enabled: true },
    select: { siteCode: true },
    distinct: ['siteCode'],
    orderBy: { siteCode: 'asc' },
  });
}

export async function removeSitePublication(
  tx: Prisma.TransactionClient,
  subject: Subject,
  value: unknown,
) {
  const existing = await publishedSites(tx, subject);
  const confirmed = confirmDeletionSites(existing, value);
  if (confirmed.length) {
    await tx.websitePublication.updateMany({
      where: { ...subject, enabled: true, siteCode: { in: confirmed } },
      data: { enabled: false, salesStopped: true, version: { increment: 1 } },
    });
  }
}

export function confirmDeletionSites(
  existing: readonly { siteCode: string }[],
  value: unknown,
): string[] {
  const requested: unknown = value === undefined ? [] : value;
  if (
    !Array.isArray(requested) ||
    requested.length > 4 ||
    requested.some((item) => typeof item !== 'string') ||
    new Set(requested).size !== requested.length
  )
    throw new BadRequestException();
  const published = new Set(existing.map(({ siteCode }) => siteCode));
  const confirmed = new Set(requested as string[]);
  if (
    confirmed.size !== published.size ||
    [...published].some((siteCode) => !confirmed.has(siteCode))
  )
    throw new ConflictException({
      code: 'SITE_DELETION_CONFIRMATION_REQUIRED',
      message: 'برای حذف، همه سایت‌های محل انتشار را انتخاب کنید.',
    });
  return [...confirmed];
}
