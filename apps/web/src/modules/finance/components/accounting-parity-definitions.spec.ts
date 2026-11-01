import { describe, expect, it } from 'vitest';
import {
  accountingParityByRoute,
  accountingParityDefinitions,
} from './accounting-parity-definitions';

describe('accounting parity evidence controls', () => {
  it('does not rename the closing page to a source precondition error', () => {
    const definition = accountingParityByRoute.get(
      'general-ledger/year-end/closing',
    );
    expect(definition?.title).toBe('صدور سند بستن حساب ها');
    expect(definition?.blockers).toContain(
      'در دوره مالی جاری سند قطعی وجود ندارد',
    );
  });
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
    expect(definition?.blockers.join(' ')).toContain(
      'عملیات جانبی هنوز کامل نیستند',
    );
  });

  it('uses the observed menu title while retaining source errors as evidence', () => {
    const failed = accountingParityDefinitions.filter(
      (d) => d.evidenceStatus === 'source-error',
    );
    expect(failed).toHaveLength(4);
    expect(
      failed.every((d) => d.title !== 'خطا' && d.stages.includes('خطا')),
    ).toBe(true);
  });
  it('publishes the exact support totals used by the executable matrix', () => {
    expect(accountingParityDefinitions).toHaveLength(91);
    expect(
      accountingParityDefinitions.filter(
        (item) => item.support === 'supported',
      ),
    ).toHaveLength(52);
    expect(
      accountingParityDefinitions.filter(
        (item) => item.support === 'dependency',
      ),
    ).toHaveLength(35);
    expect(
      accountingParityDefinitions.filter(
        (item) => item.support === 'source-error',
      ),
    ).toHaveLength(4);
  });
});
