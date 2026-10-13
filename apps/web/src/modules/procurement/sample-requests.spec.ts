import { describe, expect, it } from 'vitest';

import {
  filterSampleRequests,
  filterSampleSuppliers,
  sampleRequests,
  sampleSuppliers,
} from './sample-requests';

describe('procurement section fixtures', () => {
  it('keeps every operational section populated without experimental labels', () => {
    for (const section of [2, 4, 5, 6, 7])
      expect(
        sampleRequests.filter((row) => row.section === section),
      ).toHaveLength(6);

    expect(
      sampleRequests.some((row) => /آزمایشی|آزمون E2E/.test(row.draft.title)),
    ).toBe(false);
  });
});

describe('Purchase sample filtering', () => {
  it('keeps the same visible fallback data searchable and status-aware', () => {
    expect(
      filterSampleRequests(sampleRequests, {
        section: 7,
        search: 'فاکتور تجهیزات شبکه شعبه غرب',
      }).map((row) => row.number),
    ).toEqual(['PR-1405-134']);
    expect(
      filterSampleRequests(sampleRequests, {
        section: 5,
        status: 'CLOSED',
      }).map((row) => row.number),
    ).toEqual(['PR-1405-126']);
  });

  it('applies the visible created-date range to fallback rows', () => {
    expect(
      filterSampleRequests(sampleRequests, {
        section: 7,
        createdFrom: '2026-09-27',
        createdTo: '2026-09-30',
      }).map((row) => row.number),
    ).toEqual(['PR-1405-132', 'PR-1405-133', 'PR-1405-134', 'PR-1405-135']);
  });

  it('filters fallback suppliers with the same query the user sees', () => {
    expect(
      filterSampleSuppliers(sampleSuppliers, { search: 'خدمات فنی' }).map(
        (row) => row.code,
      ),
    ).toEqual(['SUP-DEMO-102']);
  });
});
