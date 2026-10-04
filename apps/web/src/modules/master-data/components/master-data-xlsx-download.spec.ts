import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const workspaceFiles = [
  'master-data-live-workspace.tsx',
  'master-data-finance-workspace.tsx',
  'master-data-accommodation-workspace.tsx',
  'master-data-geography-workspace.tsx',
  'master-data-suppliers-workspace.tsx',
  'master-data-insurance-workspace.tsx',
  'master-data-sales-references-workspace.tsx',
  'master-data-travel-services-workspace.tsx',
  'master-data-transportation-workspace.tsx',
] as const;

describe('Master Data XLSX download consumers', () => {
  it.each(workspaceFiles)(
    '%s delegates browser download lifecycle safely',
    (file) => {
      const source = readFileSync(
        fileURLToPath(new URL(file, import.meta.url)),
        'utf8',
      );

      expect(source).toContain("from '../api/download-file'");
      expect(source).toContain('downloadFile(');
      expect(source).not.toContain('createObjectURL(');
      expect(source).not.toContain('revokeObjectURL(');
    },
  );
});
