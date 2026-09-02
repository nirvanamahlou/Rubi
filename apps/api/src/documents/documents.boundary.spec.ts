import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function productionSources(): string {
  const root = join(process.cwd(), 'src', 'documents');
  return readdirSync(root)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .map((file) => readFileSync(join(root, file), 'utf8'))
    .join('\n');
}

describe('documents vertical-slice boundary', () => {
  it('keeps persistence inside the owning module and avoids foreign repositories', () => {
    const source = productionSources();
    expect(source).toContain('class DocumentsRepository');
    expect(source).toContain('class DocumentsService');
    expect(source).toContain('class DocumentsController');
    expect(source).not.toMatch(
      /\.\.\/(?:master-data|customers|customer-affairs|finance|ticket-catalog)\//,
    );
  });

  it('exposes the real module while keeping file bytes out of repository fields', () => {
    const files = readdirSync(join(process.cwd(), 'src', 'documents'));
    expect(files).toEqual(
      expect.arrayContaining([
        'documents.controller.ts',
        'documents.repository.ts',
        'documents.service.ts',
        'documents.storage.ts',
        'documents.module.ts',
      ]),
    );
    const source = productionSources();
    expect(source).toContain('storageObjectKey');
    expect(source).not.toMatch(/(?:fileBytes|binaryData|base64Payload)\s*:/);
  });
});
