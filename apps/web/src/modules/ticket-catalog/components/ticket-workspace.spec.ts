import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ticket workspace entry points', () => {
  it('does not mount the scheduled-offer publisher and retains repeat operations', () => {
    const source = readFileSync(
      new URL('./ticket-workspace.tsx', import.meta.url),
      'utf8',
    );
    expect(source).not.toContain("from './published-offers'");
    expect(source).toContain('managedOffers()');
    expect(source).toContain('publishFlights(inputs)');
    expect(source).toContain('publishExistingFlights(');
    expect(source).toContain('`ticket-catalog:${product.id}`');
    expect(source).toContain('backfillStarted.current');
    expect(source).toContain('repeatDefinition(');
    expect(source).toContain('setRepeat(');
  });
});
