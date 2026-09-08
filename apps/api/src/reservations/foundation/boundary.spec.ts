import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('reservations foundation module boundary', () => {
  it('has no persistence, controller, private module import or provider credential', () => {
    const root = join(process.cwd(), 'src/reservations/foundation');
    const files = readdirSync(root).filter(
      (f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'),
    );
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(join(root, file), 'utf8');
      expect(source).not.toMatch(
        /@rubi\/database|@prisma|PrismaClient|@Controller|@Injectable|localStorage|process\.env/,
      );
      const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(
        (match) => match[1],
      );
      expect(
        imports.every(
          (path) => path === 'node:crypto' || path?.startsWith('./'),
        ),
      ).toBe(true);
    }
  });
});
