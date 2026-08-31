import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const moduleRoot = join(process.cwd(), 'src', 'modules', 'documents');

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

describe('documents workspace contract', () => {
  it('renders the requested operational and security surfaces', () => {
    const source = moduleSources(moduleRoot);
    for (const marker of [
      'داشبورد اسناد',
      'همه اسناد',
      'دسته‌بندی‌ها',
      'نسخه‌های فایل',
      'فایل‌های محرمانه',
      'قرنطینه و امنیت',
      'Archive / Restore',
      'Legal Hold',
      'Retention Policy',
      'تاریخچه دسترسی',
      'AWAITING_ANTIVIRUS_ADAPTER',
      'Signed URL',
      'Mask',
      'Loading',
      'Empty',
      'Error',
      'Unauthorized',
      'Forbidden',
      'Conflict',
      'Preview',
    ])
      expect(source).toContain(marker);
  });

  it('keeps the Phase A UI synthetic and detached from persistence', () => {
    const source = moduleSources(moduleRoot);
    expect(source).not.toMatch(
      /@rubi\/database|PrismaClient|fetch\(|\/api\/v1\/documents/,
    );
    expect(source).toContain('preview-document-');
    expect(source).toContain(
      'هیچ فایل، آپلود، نتیجه اسکن یا لینک دانلود واقعی ایجاد نمی‌شود',
    );
  });
});
