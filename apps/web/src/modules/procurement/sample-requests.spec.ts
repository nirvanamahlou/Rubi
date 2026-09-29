import { describe, expect, it } from 'vitest';

import { sampleRequests } from './sample-requests';

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
