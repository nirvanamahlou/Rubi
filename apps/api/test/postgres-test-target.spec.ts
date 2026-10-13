import { describe, expect, it } from 'vitest';
import { postgresTestTarget } from './postgres-test-target';

describe('explicit PostgreSQL integration target', () => {
  it('preserves the existing opt-in PC-B target without custom settings', () => {
    expect(postgresTestTarget({})).toEqual({
      container: 'nora-postgres-1',
      port: '55432',
      user: 'nora_local',
    });
  });
  it('accepts a dedicated test container without relaxing database-name guards', () => {
    expect(
      postgresTestTarget({
        NORA_TEST_POSTGRES_CONTAINER: 'nora-test-shared-0831',
        NORA_TEST_POSTGRES_PORT: '5435',
        NORA_TEST_POSTGRES_USER: 'nora_review',
      }).port,
    ).toBe('5435');
  });
  it.each([
    { NORA_TEST_POSTGRES_CONTAINER: 'nora-postgres-1' },
    {
      NORA_TEST_POSTGRES_CONTAINER: 'nora-local-access-20260831',
      NORA_TEST_POSTGRES_PORT: '5435',
      NORA_TEST_POSTGRES_USER: 'nora_review',
    },
    {
      NORA_TEST_POSTGRES_CONTAINER: 'nora-test-shared-0831',
      NORA_TEST_POSTGRES_PORT: '5432',
      NORA_TEST_POSTGRES_USER: 'nora_review',
    },
    {
      NORA_TEST_POSTGRES_CONTAINER: 'nora-test-shared-0831',
      NORA_TEST_POSTGRES_PORT: '5434',
      NORA_TEST_POSTGRES_USER: 'nora_review',
    },
    {
      NORA_TEST_POSTGRES_CONTAINER: 'nora-test-shared-0831',
      NORA_TEST_POSTGRES_PORT: '70000',
      NORA_TEST_POSTGRES_USER: 'nora_review',
    },
    {
      NORA_TEST_POSTGRES_CONTAINER: 'nora-test-shared-0831',
      NORA_TEST_POSTGRES_PORT: '5435',
      NORA_TEST_POSTGRES_USER: 'x;drop',
    },
  ])('rejects incomplete or operational/invalid overrides', (env) => {
    expect(() => postgresTestTarget(env)).toThrow();
  });
});
