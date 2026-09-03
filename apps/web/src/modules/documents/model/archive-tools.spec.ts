import { describe, expect, it } from 'vitest';

import { archiveTools } from './archive-tools';

describe('Documents archive tools', () => {
  it('gives every archive card a unique actionable destination', () => {
    expect(archiveTools).toHaveLength(4);
    expect(new Set(archiveTools.map((tool) => tool.key)).size).toBe(4);
    expect(archiveTools.every((tool) => tool.notice.length > 10)).toBe(true);
    expect(
      archiveTools.find((tool) => tool.key === 'categories')?.query,
    ).toEqual({ completion: 'INCOMPLETE' });
    expect(archiveTools.find((tool) => tool.key === 'recovery')?.query).toEqual(
      {
        archiveStatus: 'ARCHIVED',
      },
    );
    expect(archiveTools.find((tool) => tool.key === 'owners')).toMatchObject({
      useCurrentOwner: true,
    });
    expect(archiveTools.map((tool) => tool.key)).not.toEqual(
      expect.arrayContaining(['types', 'quarantine', 'health', 'processing']),
    );
  });
});
