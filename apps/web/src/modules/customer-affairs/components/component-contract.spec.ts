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
  it('uses modal forms for all seven editing surfaces', () => {
    expect(workspaceSource.match(/<CustomerAffairsFormDialog\b/g)).toHaveLength(
      7,
    );
    const dialog = readFileSync(
      join(moduleRoot, 'components', 'customer-affairs-form-dialog.tsx'),
      'utf8',
    );
    expect(dialog).toContain('DialogTitle');
    expect(dialog).toContain('DialogDescription');
    expect(dialog).toContain('onCloseAutoFocus');
    expect(dialog).toContain('onInteractOutside');
    expect(dialog).toContain('disabled={busy}');
    expect(dialog).toContain('overflow-y-auto');
  });

  it('renders the required operational surfaces', () => {
    const source = moduleSources(moduleRoot);
    for (const marker of [
      'پیش‌فروش',
      'پشتیبانی',
      'Timeline',
      "state === 'loading'",
      'EmptyState',
      'ErrorState',
      "state === 'forbidden'",
      'SLA',
      'تعداد مسافر',
      'ثبت درخواست',
      'ارسال به فروش',
      'بازگشایی',
    ]) {
      expect(source).toContain(marker);
    }
  });

  it('uses the public API contract and stays detached from persistence', () => {
    const source = moduleSources(moduleRoot);
    expect(source).not.toMatch(
      /@nora\/database|PrismaClient|modules\/customers|modules\/master-data|iam\//,
    );
    expect(source).toContain('/customer-affairs');
    expect(source).toContain("credentials: 'include'");
    expect(source).toContain('CustomerAffairsLeadView');
  });

  it('exposes create, list, detail and real mutation actions', () => {
    expect(workspaceSource).toContain('LeadForm');
    expect(workspaceSource).toContain('TicketForm');
    expect(workspaceSource).toContain('DetailPanel');
    expect(workspaceSource).toContain('customerAffairsApi.action');
  });
});
