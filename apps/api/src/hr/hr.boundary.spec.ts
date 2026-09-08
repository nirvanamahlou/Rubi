import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const root = resolve(process.cwd(), 'src/hr');
describe('HR architecture boundary', () => {
  it('keeps the pure domain independent of infrastructure', () => {
    for (const name of readdirSync(root).filter((name) =>
      /^hr\.(application|domain|entities|policy|ports)\.ts$/.test(name),
    )) {
      const source = readFileSync(resolve(root, name), 'utf8');
      expect(source).not.toMatch(
        /@Controller|Prisma|from ['"]@rubi\/database|localStorage|sessionStorage/,
      );
      for (const match of source.matchAll(/from ['"]([^'"]+)['"]/g))
        expect(match[1]).toMatch(/^\.\/hr\./);
    }
  });
  it('uses HR-owned persistence and published IAM/Documents services', () => {
    const service = readFileSync(resolve(root, 'hr.service.ts'), 'utf8');
    expect(service).not.toMatch(
      /(?:client|tx)\.(?:user|branch|role|permission|document|customer|sales|finance)\./,
    );
    expect(service).not.toMatch(
      /\.\.\/(?:iam|documents)\/.*(?:repository|storage)/,
    );
    expect(service).toContain("'../iam/iam.service'");
    expect(service).toContain("'../documents/documents.service'");
    expect(service).not.toMatch(/localStorage|sessionStorage|preview-employee/);
  });
});
