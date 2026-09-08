import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const root = resolve(process.cwd(), 'src/hr');
describe('HR architecture boundary', () => {
  it('has no operational controller, database, fake repository or cross-module internal imports', () => {
    for (const name of readdirSync(root).filter(
      (name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'),
    )) {
      const source = readFileSync(resolve(root, name), 'utf8');
      expect(source).not.toMatch(
        /@Controller|Prisma|from ['"]@rubi\/database|localStorage|sessionStorage/,
      );
      for (const match of source.matchAll(/from ['"]([^'"]+)['"]/g))
        expect(match[1]).toMatch(/^\.\/hr\./);
    }
  });
});
