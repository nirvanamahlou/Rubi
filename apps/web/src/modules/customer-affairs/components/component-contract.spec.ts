import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const moduleRoot = join(process.cwd(), 'src', 'modules', 'customer-affairs');
const workspaceSource = readFileSync(
  join(moduleRoot, 'components', 'customer-affairs-workspace.tsx'),
  'utf8',
);

function moduleSources(directory: string): string {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return [moduleSources(path)];
      if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx'))
        return [];
      if (entry.name.endsWith('.spec.ts')) return [];
      return [readFileSync(path, 'utf8')];
    })
    .join('\n');
}

describe('customer affairs workspace contract', () => {
  it('renders the required operational preview surfaces', () => {
    for (const marker of [
      'قبل از فروش',
      'بعد از فروش',
      'Pipeline پیش از فروش',
      'Timeline فعالیت‌ها',
      "state === 'loading'",
      'EmptyState',
      'ErrorState',
      "state === 'forbidden'",
      "state === 'unauthorized'",
      'Customer 360',
      'SalesHandoffRequested',
      'Persistence',
      'SLA',
      'Qualification',
      'منبع آشنایی',
      'تعداد مسافر',
      'دسته‌بندی Ticket',
      'موعد حل SLA',
    ]) {
      expect(moduleSources(moduleRoot)).toContain(marker);
    }
  });

  it('keeps preview UI detached from persistence and internal modules', () => {
    const source = moduleSources(moduleRoot);
    expect(source).not.toMatch(
      /@rubi\/database|PrismaClient|modules\/customers|modules\/master-data|iam\//,
    );
    expect(source).toContain('preview-lead-');
    expect(source).toContain('preview-ticket-');
  });

  it('exposes create, view and edit preview modes', () => {
    expect(workspaceSource).toContain(
      "type FormMode = 'create' | 'view' | 'edit'",
    );
    expect(workspaceSource).toContain('بررسی بدون ذخیره');
  });
});
