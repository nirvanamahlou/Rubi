import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('shared ticket demo lifecycle and safety', () => {
  it('passes the standalone CLI transaction and fixture safety suite', () => {
    const output = execFileSync(
      process.execPath,
      [
        '--test',
        resolve(__dirname, '../../../scripts/ticket-demo-core.test.mjs'),
      ],
      { encoding: 'utf8' },
    );
    expect(output).toMatch(/pass 8/);
    expect(output).toMatch(/fail 0/);
  }, 20000);
});
