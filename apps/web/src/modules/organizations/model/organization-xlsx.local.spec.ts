import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import {
  unzipWorkbook,
  validateOrganizationWorkbookXml,
} from './organization-xlsx';

// Opt-in local diagnosis: customer workbooks must never become Git fixtures.
it.skipIf(!process.env.AGENCY_WORKBOOK_PATH)(
  'reads the supplied workbook without following hyperlinks',
  async () => {
    const bytes = await readFile(process.env.AGENCY_WORKBOOK_PATH!);
    const files = await unzipWorkbook(Uint8Array.from(bytes).buffer);
    expect(files.has('xl/worksheets/sheet1.xml')).toBe(true);
    for (const [name, xml] of files)
      if (name.endsWith('.xml') || name.endsWith('.rels'))
        expect(() => validateOrganizationWorkbookXml(xml)).not.toThrow();
  },
);
