import { describe, expect, it } from 'vitest';

import {
  LEGAL_ENTITIES_CONTRACT_VERSION,
  LEGAL_ENTITY_CODES,
  LEGAL_ENTITY_CONTEXT_ALL,
  LEGAL_ENTITY_PERMISSION_CODES,
} from '../src';

describe('legal-entities.v2 public contract', () => {
  it('publishes only the two real issuer records and keeps ALL virtual', () => {
    expect(LEGAL_ENTITIES_CONTRACT_VERSION).toBe(2);
    expect(LEGAL_ENTITY_CODES).toEqual(['NIYAYESH_SEIR_SAHAR', 'JAHAN_BASTAN']);
    expect(LEGAL_ENTITY_CODES).not.toContain(LEGAL_ENTITY_CONTEXT_ALL);
  });

  it('publishes deny-by-default legal entity permissions', () => {
    expect(LEGAL_ENTITY_PERMISSION_CODES).toHaveLength(8);
    expect(LEGAL_ENTITY_PERMISSION_CODES).toContain(
      'legal-entity.aggregate.read',
    );
    expect(LEGAL_ENTITY_PERMISSION_CODES).toContain(
      'legal-entity.document.reissue',
    );
  });
});
