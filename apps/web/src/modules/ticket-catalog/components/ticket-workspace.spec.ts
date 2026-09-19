import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ticket workspace entry points', () => {
  it('does not mount the scheduled-offer publisher and retains repeat operations', () => {
    const source = readFileSync(
      new URL('./ticket-workspace.tsx', import.meta.url),
      'utf8',
    );
    expect(source).not.toContain('PublishedOffers');
    expect(source).toContain('repeatDefinition(');
    expect(source).toContain('setRepeat(');
  });
});
