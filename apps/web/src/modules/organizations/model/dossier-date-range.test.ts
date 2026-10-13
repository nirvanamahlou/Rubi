import { describe, expect, it } from 'vitest';
import { dossierDateBoundary, inDossierDateRange } from './dossier-date-range';
describe('dossier date ranges', () => {
  const range = { from: '2026-09-11', to: '2026-09-11' };
  it('includes both bounds using Tehran calendar days', () => {
    expect(inDossierDateRange('2026-09-10T20:30:00Z', range)).toBe(true);
    expect(inDossierDateRange('2026-09-11T20:29:59.999Z', range)).toBe(true);
    expect(inDossierDateRange('2026-09-11T20:30:00Z', range)).toBe(false);
    expect(inDossierDateRange('2026-09-11', range)).toBe(true);
    expect(dossierDateBoundary(range.from)).toBe('2026-09-10T20:30:00.000Z');
    expect(dossierDateBoundary(range.to, true)).toBe(
      '2026-09-11T20:29:59.999Z',
    );
  });
  it('supports open bounds and rejects reversed ranges and invalid timestamps', () => {
    expect(inDossierDateRange('2026-09-12', { from: range.from, to: '' })).toBe(
      true,
    );
    expect(inDossierDateRange('2026-09-10', { from: '', to: range.to })).toBe(
      true,
    );
    expect(
      inDossierDateRange('2026-09-11', { from: '2026-09-12', to: range.to }),
    ).toBe(false);
    expect(inDossierDateRange('invalid', range)).toBe(false);
    expect(() => dossierDateBoundary('2026-02-30')).toThrow();
  });
  it('uses historical Tehran summer offset when converting document bounds', () => {
    expect(dossierDateBoundary('2020-07-01')).toBe('2020-06-30T19:30:00.000Z');
  });
});
