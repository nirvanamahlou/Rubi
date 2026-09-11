import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('login background', () => {
  const source = fs.readFileSync(path.resolve(__dirname, 'page.tsx'), 'utf8');
  const asset = path.resolve(
    __dirname,
    '../../../public/brand/login-airline-b2.png',
  );

  it('uses the selected B2 aviation background with a readable overlay', () => {
    expect(source).toContain("bg-[url('/brand/login-airline-b2.png')]");
    expect(source).toContain('bg-cover bg-center');
    expect(source).toContain('aria-hidden="true"');
    expect(source).toContain('backdrop-blur-sm');
    expect(fs.existsSync(asset)).toBe(true);
    expect(fs.statSync(asset).size).toBeGreaterThan(100_000);
  });
});
