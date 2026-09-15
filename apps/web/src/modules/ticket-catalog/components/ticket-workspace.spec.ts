import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ticket workspace entry points', () => {
  it('retains catalog repeat operations', () => {
    const source = readFileSync(
      new URL('./ticket-workspace.tsx', import.meta.url),
      'utf8',
    );
    expect(source).toContain('repeatDefinition(');
    expect(source).toContain('setRepeat(');
  });
});
