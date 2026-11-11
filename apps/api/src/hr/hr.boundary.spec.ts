import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const root = resolve(process.cwd(), 'src/hr');
describe('HR architecture boundary', () => {
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
