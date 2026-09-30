import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const sourceRoot = resolve(process.cwd(), 'public/package-generator');

function load<T>(file: string, globalName: string): T {
  const context: Record<string, unknown> = {};
  runInNewContext(readFileSync(resolve(sourceRoot, file), 'utf8'), context);
  return context[globalName] as T;
}

describe('Thailand poster spreadsheet mapping', () => {
  const parser = load<{
    thailandSaleColumns: (
      headers: { key: string; col: string }[],
      fallback: Record<string, string>,
    ) => Record<string, string>;
  }>('pkj.js', 'PKJ');

  it.each([
    {
      city: 'Pattaya',
      columns: [
        'Hotel',
        'SGL',
        'DBL',
        'CWB',
        'CNB',
        'SINGLE',
        'DBLE',
        'CWB',
        'CNB',
      ],
      expected: { double: 'G', single: 'F', child: 'H', small: 'I' },
    },
    {
      city: 'Phuket',
      columns: [
        'hkt',
        'dbl hkt',
        'single',
        'wb',
        'no bed hkt',
        'DBL',
        'SGL',
        'WB',
        'NOBED',
      ],
      expected: { double: 'F', single: 'G', child: 'H', small: 'I' },
    },
    {
      city: 'Bangkok–Phuket',
      columns: [
        'hkt',
        'dbl hkt',
        'chd wb',
        'sgl hkt',
        'no bed hkt',
        'DBL',
        'SGL',
        'WB',
        'NOBED',
      ],
      expected: { double: 'F', single: 'G', child: 'H', small: 'I' },
    },
  ])('uses final sale columns for $city', ({ columns, expected }) => {
    const headers = columns.map((key, index) => ({
      key: key.replace(/\s/g, '').toLowerCase(),
      col: String.fromCharCode(65 + index),
    }));
    const actual = parser.thailandSaleColumns(headers, {
      double: 'B',
      single: 'B',
      child: 'C',
      small: 'D',
    });

    expect(actual).toEqual(expected);
  });

  it('recognizes the under-two fare as a child price, not a services note', () => {
    const summary = load<{ kind: (text: string) => string }>(
      'summary.js',
      'PackageSummary',
    );

    expect(summary.kind('کودک زیر 2سال 29.990.000تومان')).toBe('childFlight');
  });
});
