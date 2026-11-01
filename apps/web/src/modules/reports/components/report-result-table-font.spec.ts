import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('report data font boundary', () => {
  it('uses installed B Nazanin only on data cells and preserves the rest of the page', () => {
    const css = readFileSync(
      new URL('./report-result-table.module.css', import.meta.url),
      'utf8',
    );
    const source = readFileSync(
      new URL('./reporting-workspace.tsx', import.meta.url),
      'utf8',
    );
    expect(css).toContain("local('B Nazanin')");
    expect(css).toContain('.dataCells td');
    expect(css).not.toContain('https://');
    expect(source).toContain('<tbody className={resultTableStyles.dataCells}>');
  });
});
