import { expect, it } from 'vitest';
import { websitePresentation } from './publication-presentation';
it('keeps plain display text and a bounded commission without changing the package', () => {
  expect(
    websitePresentation({
      title: '  Site title ',
      description: ' Description ',
      commissionPercent: '12.5000',
    }),
  ).toEqual({
    title: 'Site title',
    description: 'Description',
    commissionPercent: '12.5000',
  });
});
it.each([
  null,
  [],
  { title: 'x', description: 'y', commissionPercent: '-1' },
  { title: 'x', description: 'y', commissionPercent: '101' },
  { title: 'x', description: 'y', commissionPercent: 10 },
])('rejects malformed presentation %j', (value) => {
  expect(() => websitePresentation(value)).toThrow();
});
