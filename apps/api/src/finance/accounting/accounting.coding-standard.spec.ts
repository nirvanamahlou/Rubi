import { describe, expect, it } from 'vitest';
import { codingStandardAttributes } from './accounting.coding-standard';

const id = '10000000-0000-4000-8000-000000000001';
const entity = {
  id,
  title: 'گروه حساب',
  titleEn: 'Group',
  systemEntity: 'گروه حساب',
  detailReference: 'STANDARD',
};
const input = () => ({
  protocolVersion: '1.0',
  entities: JSON.stringify([entity]),
  extraFields: '[]',
});
describe('coding standard metadata', () => {
  it('round trips the observed entity fields without creating codes', () => {
    const result = codingStandardAttributes(input());
    expect(JSON.parse(String(result.entities))).toEqual([entity]);
    expect(result.isSystem).toBe(false);
    expect(result).not.toHaveProperty('codes');
  });
  it('rejects attempts to create or change source-owned standards', () => {
    expect(() =>
      codingStandardAttributes({ ...input(), isSystem: true }),
    ).toThrow();
    expect(() =>
      codingStandardAttributes(input(), { isSystem: true }),
    ).toThrow();
  });
  it('rejects duplicate row IDs and unknown entities or detail references', () => {
    for (const entities of [
      [entity, entity],
      [{ ...entity, systemEntity: 'fabricated' }],
      [{ ...entity, detailReference: 'invented' }],
    ])
      expect(() =>
        codingStandardAttributes({
          ...input(),
          entities: JSON.stringify(entities),
        }),
      ).toThrow();
  });
  it('requires a title for every populated row and rejects oversized payloads', () => {
    expect(() =>
      codingStandardAttributes({
        ...input(),
        entities: JSON.stringify([{ ...entity, title: '' }]),
      }),
    ).toThrow();
    expect(() =>
      codingStandardAttributes({
        ...input(),
        extraFields: JSON.stringify([
          { id, title: 'فیلد', value: 'x'.repeat(501) },
        ]),
      }),
    ).toThrow();
  });
  it('rejects executable or unrecognized attributes instead of storing them', () => {
    expect(() =>
      codingStandardAttributes({ ...input(), formula: 'process.exit()' }),
    ).toThrow();
  });
});
