import { describe, expect, it } from 'vitest';
import {
  accountingParityByRoute,
  accountingParityDefinitions,
} from './accounting-parity-definitions';

describe('accounting parity evidence controls', () => {
  it('preserves every observed source radio control as a radio', () => {
    const expected = new Set([
      'rdbAccountGroup',
      'rdbGL',
      'rdbSL',
      'rdbStructural',
      'rdCOA',
      'rdDLLevels',
      'rdCounterPart',
      'rdoMisMatchedItem',
      'rdoMatchedItem',
      'rdoAllItems',
    ]);
    const observed = accountingParityDefinitions
      .flatMap((definition) => definition.fields)
      .filter((field) => expected.has(field.sourceControlId ?? ''));

    expect(new Set(observed.map((field) => field.sourceControlId))).toEqual(
      expected,
    );
    expect(observed.every((field) => field.type === 'radio')).toBe(true);
  });

  it('keeps the distinct GL voucher list as an explicit dependency', () => {
    const definition = accountingParityByRoute.get(
      'general-ledger/documents/lists/gl-vouchers',
    );
    expect(definition).toMatchObject({
      title: 'سند کل',
      implementation: 'evidence-only',
      support: 'dependency',
    });
    expect(definition?.blockers.join(' ')).toContain('قرارداد تجمیع سند کل');
  });

  it('publishes the exact support totals used by the executable matrix', () => {
    expect(accountingParityDefinitions).toHaveLength(87);
    expect(
      accountingParityDefinitions.filter(
        (item) => item.support === 'supported',
      ),
    ).toHaveLength(37);
    expect(
      accountingParityDefinitions.filter(
        (item) => item.support === 'dependency',
      ),
    ).toHaveLength(46);
    expect(
      accountingParityDefinitions.filter(
        (item) => item.support === 'source-error',
      ),
    ).toHaveLength(4);
  });
});
