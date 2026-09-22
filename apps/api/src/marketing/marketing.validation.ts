import { MarketingDomainError } from './marketing.errors';
import { isUtcTimestamp, type CampaignStatus } from './marketing.domain';

export const marketingSortFields = [
  'name',
  'internalCode',
  'status',
  'startsAt',
  'endsAt',
  'budget',
  'spend',
  'audienceCount',
  'conversionCount',
  'updatedAt',
  'version',
] as const;

export type MarketingSortField = (typeof marketingSortFields)[number];

export interface MarketingListQuery {
  search?: string;
  status?: CampaignStatus | 'ALL';
  channel?: string | 'ALL';
  company?: string | 'ALL';
  startsFrom?: string;
  endsUntil?: string;
  sortBy?: MarketingSortField;
  sortDirection?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface NormalizedMarketingListQuery {
  search: string;
  status: CampaignStatus | 'ALL';
  channel: string | 'ALL';
  company: string | 'ALL';
  startsFrom: string | null;
  endsUntil: string | null;
  sortBy: MarketingSortField;
  sortDirection: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

function containsForbiddenControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return (
      codePoint !== undefined &&
      (codePoint <= 8 ||
        codePoint === 11 ||
        codePoint === 12 ||
        (codePoint >= 14 && codePoint <= 31) ||
        codePoint === 127)
    );
  });
}

export function normalizeMarketingListQuery(
  query: MarketingListQuery,
): NormalizedMarketingListQuery {
  const search = query.search?.trim() ?? '';
  if (
    search.length > 100 ||
    containsForbiddenControlCharacter(search) ||
    /[<>]/.test(search)
  ) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Marketing search term is invalid.',
      { field: 'search' },
    );
  }
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;
  if (!Number.isInteger(page) || page < 1 || page > 10_000) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Page must be an integer between 1 and 10000.',
      { field: 'page' },
    );
  }
  if (!Number.isInteger(pageSize) || pageSize < 5 || pageSize > 100) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Page size must be an integer between 5 and 100.',
      { field: 'pageSize' },
    );
  }
  const sortBy = query.sortBy ?? 'updatedAt';
  if (!marketingSortFields.includes(sortBy)) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Marketing sort field is not allowed.',
      { field: 'sortBy' },
    );
  }
  const startsFrom = query.startsFrom ?? null;
  const endsUntil = query.endsUntil ?? null;
  if (startsFrom && !isUtcTimestamp(startsFrom)) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Start filter must use a UTC timestamp.',
      { field: 'startsFrom' },
    );
  }
  if (endsUntil && !isUtcTimestamp(endsUntil)) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'End filter must use a UTC timestamp.',
      { field: 'endsUntil' },
    );
  }
  if (
    startsFrom &&
    endsUntil &&
    Date.parse(startsFrom) > Date.parse(endsUntil)
  ) {
    throw new MarketingDomainError(
      'MARKETING_VALIDATION_ERROR',
      'Marketing filter date range is reversed.',
      { fields: ['startsFrom', 'endsUntil'] },
    );
  }
  return {
    search,
    status: query.status ?? 'ALL',
    channel: query.channel ?? 'ALL',
    company: query.company ?? 'ALL',
    startsFrom,
    endsUntil,
    sortBy,
    sortDirection: query.sortDirection ?? 'desc',
    page,
    pageSize,
  };
}
