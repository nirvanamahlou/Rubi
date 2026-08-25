import {
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import {
  assertLegalEntitySelection,
  resolveIssueTargetIds,
} from './legal-entities.policy';

describe('legal entity backend policy', () => {
  it('rejects a tampered ALL selection without aggregate permission', () => {
    expect(() =>
      assertLegalEntitySelection('ALL', [
        'legal-entity.read',
        'legal-entity.switch',
      ]),
    ).toThrow(ForbiddenException);
  });

  it('allows ALL only with aggregate permission', () => {
    expect(() =>
      assertLegalEntitySelection('ALL', ['legal-entity.aggregate.read']),
    ).not.toThrow();
  });

  it('blocks combined letterhead by requiring an issuer or two independent targets', () => {
    expect(resolveIssueTargetIds('ALL', null, ['a', 'b'], 'prompt')).toEqual({
      ids: [],
      requiresExplicitIssuer: true,
    });
    expect(resolveIssueTargetIds('ALL', null, ['a', 'b'], 'separate')).toEqual({
      ids: ['a', 'b'],
      requiresExplicitIssuer: false,
    });
  });

  it('requires a real issuer for specific context', () => {
    expect(() =>
      resolveIssueTargetIds('NIYAYESH_SEIR_SAHAR', null, ['a', 'b'], 'prompt'),
    ).toThrow(UnprocessableEntityException);
  });
});
