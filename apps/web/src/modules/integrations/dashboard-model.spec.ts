import { describe, expect, it } from 'vitest';
import type {
  IntegrationRegistryV1,
  IntegrationSystemConfigV1,
} from '@nora/contracts';
import {
  metricState,
  periodLabel,
  periodRange,
  validRange,
} from './dashboard-model';
import { catalogueSystems } from './model';

describe('Integration dashboard evidence and reporting range', () => {
  it('does not confuse unavailable counts with real zero or catalogue readiness', () => {
    const system = {
      businessDomain: 'TRAVEL',
      lifecycle: 'ENABLED',
    } as IntegrationSystemConfigV1;
    for (const metric of ['sales', 'users', 'orders', 'pending'] as const) {
      expect(metricState(system, metric)).toBe('داده موجود نیست');
    }
  });
  it('excludes any education or other system from travel sales regardless of name', () => {
    for (const businessDomain of ['EDUCATION', 'OTHER'] as const) {
      const system = {
        name: 'A configurable new system',
        businessDomain,
      } as IntegrationSystemConfigV1;
      expect(metricState(system, 'sales')).toBe('نامرتبط');
      expect(metricState(system, 'users')).toBe('داده موجود نیست');
    }
  });
  it('excludes archived systems and systems under disabled brands from every dashboard drilldown', () => {
    const registry = {
      brands: [
        { id: 'a', lifecycle: 'ENABLED' },
        { id: 'b', lifecycle: 'DISABLED' },
      ],
      systems: [
        { id: 'one', brandId: 'a', lifecycle: 'ENABLED' },
        { id: 'two', brandId: 'a', lifecycle: 'ARCHIVED' },
        { id: 'three', brandId: 'b', lifecycle: 'ENABLED' },
      ],
    } as IntegrationRegistryV1;
    expect(
      catalogueSystems(registry, undefined, true).map((row) => row.id),
    ).toEqual(['one']);
    expect(catalogueSystems(registry)).toHaveLength(3);
  });
  it('uses Tehran date at UTC midnight boundaries', () => {
    expect(periodRange('today', new Date('2026-10-14T21:00:00Z'))).toEqual({
      from: '2026-10-15',
      to: '2026-10-15',
    });
  });
  it('includes exactly seven and thirty reporting dates', () => {
    const now = new Date('2026-10-15T12:00:00Z');
    expect(periodRange('week', now)).toEqual({
      from: '2026-10-09',
      to: '2026-10-15',
    });
    expect(periodRange('month', now)).toEqual({
      from: '2026-09-16',
      to: '2026-10-15',
    });
  });
  it('uses the Persian month boundary for current month', () => {
    expect(periodRange('current', new Date('2026-10-15T12:00:00Z'))).toEqual({
      from: '2026-09-23',
      to: '2026-10-15',
    });
  });
  it('rejects incomplete or reversed custom periods and does not label them as a valid report', () => {
    expect(validRange('', '2026-10-15')).toBe(false);
    expect(validRange('2026-10-16', '2026-10-15')).toBe(false);
    expect(validRange('2026-10-15', '2026-10-15')).toBe(true);
    expect(periodLabel('', '')).toBe('بازه زمانی را کامل کنید');
  });
});
