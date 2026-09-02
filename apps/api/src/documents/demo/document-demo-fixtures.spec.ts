import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createSyntheticDocumentPng,
  documentDemoFixtures,
} from './document-demo-fixtures';
import {
  LOCAL_DOCUMENTS_DEMO_ACKNOWLEDGEMENT,
  parseLocalDocumentsDemoCli,
} from './local-document-demo-cli';
import { assertLocalDocumentsDemoTarget } from './local-document-demo';

describe('portable synthetic Documents demo fixtures', () => {
  it('creates seven unique, valid and visibly distinct PNG fixtures without PII', () => {
    const fixtures = documentDemoFixtures(new Date('2026-09-01T10:00:00.000Z'));
    expect(fixtures).toHaveLength(7);
    expect(new Set(fixtures.map((fixture) => fixture.documentId)).size).toBe(7);
    expect(new Set(fixtures.map((fixture) => fixture.versionId)).size).toBe(7);
    expect(
      new Set(fixtures.map((fixture) => fixture.sourceEntityId)).size,
    ).toBe(7);
    expect(
      new Set(
        fixtures.map((fixture) =>
          createHash('sha256').update(fixture.contents).digest('hex'),
        ),
      ).size,
    ).toBe(7);
    for (const fixture of fixtures) {
      expect(fixture.contents.subarray(0, 8)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
      expect(fixture.contents.length).toBeGreaterThan(1_000);
      expect(fixture.title).toMatch(/آزمایشی/);
      expect(JSON.stringify(fixture)).not.toMatch(
        /(?:@|\b09\d{9}\b|iban|accountNumber|passportNumber|nationalId|cvv)/i,
      );
    }
  });

  it('keeps relative expiry examples for current overview cards', () => {
    const now = new Date('2026-09-01T10:00:00.000Z');
    const fixtures = documentDemoFixtures(now);
    expect(
      fixtures.filter(
        (fixture) => fixture.validUntil && fixture.validUntil < now,
      ),
    ).toHaveLength(1);
    expect(
      fixtures.filter(
        (fixture) =>
          fixture.validUntil &&
          fixture.validUntil >= now &&
          fixture.validUntil.getTime() <= now.getTime() + 30 * 86_400_000,
      ),
    ).toHaveLength(2);
  });

  it('generates deterministic PNG bytes', () => {
    const palette = [
      [10, 20, 30],
      [40, 50, 60],
      [220, 230, 240],
    ] as const;
    expect(createSyntheticDocumentPng(palette, 3)).toEqual(
      createSyntheticDocumentPng(palette, 3),
    );
    expect(createSyntheticDocumentPng(palette, 3)).not.toEqual(
      createSyntheticDocumentPng(palette, 4),
    );
  });

  it.each([
    [
      'postgresql://localhost:55432/rubi?schema=public',
      'development',
      '.data/documents',
    ],
    [
      'postgresql://127.0.0.1:55432/rubi_documents_demo_test_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'test',
      'C:\\temp\\rubi-documents-demo',
    ],
  ])('allows only intended local targets', (url, environment, storageRoot) => {
    expect(() =>
      assertLocalDocumentsDemoTarget(url, environment, storageRoot),
    ).not.toThrow();
  });

  it.each([
    [
      'postgresql://remote.example:55432/rubi',
      'development',
      '.data/documents',
    ],
    ['postgresql://127.0.0.1:5432/rubi', 'development', '.data/documents'],
    ['postgresql://127.0.0.1:55432/rubi', 'production', '.data/documents'],
    [
      'postgresql://127.0.0.1:55432/rubi?schema=other',
      'test',
      '.data/documents',
    ],
    ['postgresql://127.0.0.1:55432/rubi', 'test', 'C:\\'],
    ['postgresql://127.0.0.1:55432/rubi', 'test', 'C:/'],
    ['postgresql://127.0.0.1:55432/rubi', 'test', '\\\\server\\share'],
    ['postgresql://127.0.0.1:55432/rubi', 'test', '//server/share'],
  ])('rejects unsafe database or storage targets', (url, environment, root) => {
    expect(() =>
      assertLocalDocumentsDemoTarget(url, environment, root),
    ).toThrow();
  });

  it('requires explicit acknowledgement for apply and never for preview', () => {
    expect(parseLocalDocumentsDemoCli(['--preview'], {})).toEqual({
      apply: false,
    });
    expect(
      parseLocalDocumentsDemoCli(
        ['--apply', LOCAL_DOCUMENTS_DEMO_ACKNOWLEDGEMENT],
        {},
      ),
    ).toEqual({ apply: true });
    expect(() => parseLocalDocumentsDemoCli(['--apply'], {})).toThrow(
      'acknowledge',
    );
    expect(() =>
      parseLocalDocumentsDemoCli(
        ['--preview', LOCAL_DOCUMENTS_DEMO_ACKNOWLEDGEMENT],
        {},
      ),
    ).toThrow('Preview');
  });

  it('prepares local migrations and reference seed before apply, then verifies seven clean records', () => {
    const runner = readFileSync(
      resolve(process.cwd(), 'scripts/run-local-documents-demo.mjs'),
      'utf8',
    );
    const seed = readFileSync(
      resolve(process.cwd(), 'scripts/seed-documents-demo.mjs'),
      'utf8',
    );
    expect(runner).toContain("if (mode === '--apply')");
    expect(runner).toContain("'migrate',");
    expect(runner).toContain("'db:seed'");
    expect(seed).toContain('report.records.length === 7');
    expect(seed).toContain("row.scanStatus === 'CLEAN'");
    expect(seed).toContain('readyForViewing');
    expect(runner).toContain('runPnpmWithRetry');
  });
});
