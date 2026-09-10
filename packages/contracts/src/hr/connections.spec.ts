import { describe, expect, it } from 'vitest';
import {
  HR_CONNECTION_MODULES,
  HR_CONNECTION_TARGETS,
  hrConnectionModule,
} from './connections';
describe('HR main-menu integration contract', () => {
  it('covers every destination with unique safe internal routes', () => {
    expect(HR_CONNECTION_MODULES).toHaveLength(16);
    expect(new Set(HR_CONNECTION_MODULES.map((m) => m.path)).size).toBe(16);
    expect(
      HR_CONNECTION_MODULES.filter((m) => m.mode === 'REFERRAL').map(
        (m) => m.key,
      ),
    ).toEqual(HR_CONNECTION_TARGETS);
    for (const module of HR_CONNECTION_MODULES)
      expect(hrConnectionModule(`${module.path}/detail`)).toEqual(module);
    expect(hrConnectionModule('/finance-unrelated')).toBeUndefined();
    expect(hrConnectionModule('https://other.test/finance')).toBeUndefined();
  });
  it('routes tickets through Reservations and leaves dashboards as projections', () => {
    expect(hrConnectionModule('/ticket-management')?.mode).toBe(
      'VIA_RESERVATIONS',
    );
    expect(hrConnectionModule('/dashboard')?.mode).toBe('REPORT');
    expect(hrConnectionModule('/reports')?.mode).toBe('REPORT');
  });
});
