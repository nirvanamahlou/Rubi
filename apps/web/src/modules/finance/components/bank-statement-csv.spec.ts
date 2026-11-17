import { describe, it, expect } from 'vitest';
import { parseBankCsv } from './bank-statement-csv';
const header = 'date,credit,debit,reference,description\n';
describe('bank statement import', () => {
  it('preserves text references and decimal direction', () => {
    expect(
      parseBankCsv(
        header + '2026-03-01,,1000000000000000000.01,00025,"fee, tax"',
      ),
    ).toEqual([
      {
        date: '2026-03-01',
        amount: '-1000000000000000000.01',
        reference: '00025',
        description: 'fee, tax',
      },
    ]);
  });
  it.each([
    '2026-03-01,30,20,r,test',
    '2026-03-01,0,0,r,test',
    '2026-03-01,,5,r,"open',
    '2026-03-01,1e6,,r,test',
  ])('rejects ambiguous bank movements', (row) =>
    expect(() => parseBankCsv(header + row)).toThrow(),
  );
});
