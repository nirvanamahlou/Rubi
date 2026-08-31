import { describe, expect, it } from 'vitest';
import { postgresTestTarget } from './postgres-test-target';

describe('explicit PostgreSQL integration target', () => {
  it('preserves the existing opt-in PC-B target without custom settings', () => {
    expect(postgresTestTarget({})).toEqual({
      container: 'rubi-postgres-1',
      port: '55432',
      user: 'rubi_local',
    });
  });
  it('accepts a dedicated test container without relaxing database-name guards', () => {
    expect(
      postgresTestTarget({
        RUBI_TEST_POSTGRES_CONTAINER: 'rubi-test-shared-0831',
        RUBI_TEST_POSTGRES_PORT: '5435',
        RUBI_TEST_POSTGRES_USER: 'rubi_review',
      }).port,
    ).toBe('5435');
  });
  it.each([
    { RUBI_TEST_POSTGRES_CONTAINER: 'rubi-postgres-1' },
    {
      RUBI_TEST_POSTGRES_CONTAINER: 'rubi-local-access-20260831',
      RUBI_TEST_POSTGRES_PORT: '5435',
      RUBI_TEST_POSTGRES_USER: 'rubi_review',
    },
    {
      RUBI_TEST_POSTGRES_CONTAINER: 'rubi-test-shared-0831',
      RUBI_TEST_POSTGRES_PORT: '5432',
      RUBI_TEST_POSTGRES_USER: 'rubi_review',
    },
    {
      RUBI_TEST_POSTGRES_CONTAINER: 'rubi-test-shared-0831',
      RUBI_TEST_POSTGRES_PORT: '5434',
      RUBI_TEST_POSTGRES_USER: 'rubi_review',
    },
    {
      RUBI_TEST_POSTGRES_CONTAINER: 'rubi-test-shared-0831',
      RUBI_TEST_POSTGRES_PORT: '70000',
      RUBI_TEST_POSTGRES_USER: 'rubi_review',
    },
    {
      RUBI_TEST_POSTGRES_CONTAINER: 'rubi-test-shared-0831',
      RUBI_TEST_POSTGRES_PORT: '5435',
      RUBI_TEST_POSTGRES_USER: 'x;drop',
    },
  ])('rejects incomplete or operational/invalid overrides', (env) => {
    expect(() => postgresTestTarget(env)).toThrow();
  });
});
