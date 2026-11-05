import { expect, it } from 'vitest';
import { ManifestTemplateController } from './manifest-template.controller';
it('rejects unauthorized preparation before reading any workbook bytes', () => {
  const c = new ManifestTemplateController();
  expect(() =>
    c.prepare({ buffer: Buffer.from('invalid'), originalname: 'sample.xlsm' }, {
      actor: { permissions: [] },
    } as never),
  ).toThrow();
  expect(() =>
    c.prepare({ buffer: Buffer.from('invalid'), originalname: 'sample.csv' }, {
      actor: { permissions: ['master_data.create'] },
    } as never),
  ).toThrow('MANIFEST_TEMPLATE_INVALID');
});
