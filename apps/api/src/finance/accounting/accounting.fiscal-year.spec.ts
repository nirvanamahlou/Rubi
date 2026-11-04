import { describe, expect, it } from 'vitest';
import { fiscalYearAttributes } from './accounting.fiscal-year';
const note = {
  id: '10000000-0000-4000-8000-000000000001',
  title: 'Note',
  text: 'Body',
  date: '',
  createdBy: 'forged',
};
describe('fiscal year metadata', () => {
  it('keeps optional notes separate from description and stamps the authenticated author', () => {
    const saved = fiscalYearAttributes(
      { notes: JSON.stringify([note]) },
      undefined,
      'Actual actor',
    );
    const rows = JSON.parse(String(saved.notes));
    expect(rows[0]).toMatchObject({
      title: 'Note',
      text: 'Body',
      date: '',
      createdBy: 'Actual actor',
      updatedBy: 'Actual actor',
    });
    expect(fiscalYearAttributes({}, undefined, 'Actual actor')).toEqual({});
    expect(fiscalYearAttributes(saved, saved, 'Another actor')).toEqual(saved);
  });
  it('rejects fiscal boundaries and arbitrary attributes in the shared definition', () => {
    for (const attributes of [
      { startDate: '2026-01-01' },
      { active: true },
      { notes: 'invalid' },
    ])
      expect(() =>
        fiscalYearAttributes(attributes, undefined, 'Actor'),
      ).toThrow();
  });
});
