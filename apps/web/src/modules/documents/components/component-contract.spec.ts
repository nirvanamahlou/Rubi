import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const moduleRoot = join(process.cwd(), 'src', 'modules', 'documents');
const overlaysSource = readFileSync(
  join(process.cwd(), 'src', 'components', 'ui', 'overlays.tsx'),
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

describe('documents workspace contract', () => {
  it('renders the real operational, security and detail surfaces', () => {
    const source = moduleSources(moduleRoot);
    for (const marker of [
      'نمای کلی',
      'همه اسناد',
      'مشتری و هویت',
      'فروش و قرارداد',
      'خرید و مالی',
      'مدیریت آرشیو',
      'پیش‌نمایش',
      'اطلاعات',
      'ارتباطات',
      'نسخه‌ها',
      'دسترسی و اشتراک',
      'فعالیت و نگهداری',
      'AWAITING_ANTIVIRUS_ADAPTER',
      'ثبت از تاریخ',
      'ثبت تا تاریخ',
      'در حال بارگذاری اسناد',
      'آرشیو خالی است',
      'نتیجه‌ای پیدا نشد',
      'نشست شما پایان یافته است',
      'دسترسی به اسناد مجاز نیست',
    ])
      expect(source).toContain(marker);
  });

  it('uses the versioned backend and contains no production preview records', () => {
    const source = moduleSources(moduleRoot);
    expect(source).toContain('documentsApi.list');
    expect(source).toContain("request<DocumentDetailResponseV1>('/upload'");
    expect(source).toContain('FormData');
    expect(source).not.toMatch(/@rubi\/database|PrismaClient/);
    expect(source).not.toContain('preview-document-');
    expect(source).not.toContain('documentsPhaseANotice');
  });

  it('centers dialogs physically in RTL instead of translating logical start', () => {
    expect(overlaysSource).toContain('fixed left-1/2 top-1/2');
    expect(overlaysSource).not.toContain('fixed start-1/2 top-1/2');
  });
});
