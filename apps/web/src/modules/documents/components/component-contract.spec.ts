import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const moduleRoot = join(process.cwd(), 'src', 'modules', 'documents');
const overlaysSource = readFileSync(
  join(process.cwd(), 'src', 'components', 'ui', 'overlays.tsx'),
  'utf8',
);
const bulkDialogSource = readFileSync(
  join(moduleRoot, 'components', 'document-bulk-actions-dialog.tsx'),
  'utf8',
);
const deleteDialogSource = readFileSync(
  join(moduleRoot, 'components', 'document-delete-dialog.tsx'),
  'utf8',
);
const editDialogSource = readFileSync(
  join(moduleRoot, 'components', 'document-edit-dialog.tsx'),
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
      'تازه‌های آرشیو',
      'کارهای من',
      'ارتباط اسناد با بخش‌های روبی',
      'همه مسیرهای آرشیو',
      'اسناد این بخش',
      'متصل به ماژول',
      'بازکردن بخش مربوطه',
      'پرونده‌ای برای این فایل ثبت نشده است',
      'بازگشت به نمای کلی',
      'لینک‌های داخلی اسناد',
      'اسناد من',
      'بارگذاری‌های من',
      'اخیراً دیده‌شده',
      'علاقه‌مندی‌ها',
      'نمایش امن تصویر',
      'تصویر اسکن‌شده و مجاز',
      'پرونده مربوطه',
      'جست‌وجوی پرونده',
      '.caseOptions(',
      'عملیات گروهی',
      'حذف دائمی',
      'مدرک ناقص',
      'ابتدا فیلتر را انتخاب کنید',
      'ابتدا فیلتر اشتراک‌گذاری را انتخاب کنید',
      'تاریخچه فعالیت‌ها',
      'سیاست نگهداری',
      'نوع فایل',
      'DocumentEditDialog',
      'DocumentDeleteDialog',
      'DocumentBulkActionsDialog',
      'documentsApi.permanentlyDelete',
      'documentsApi.bulk',
    ])
      expect(source).toContain(marker);
    for (const removedCopy of [
      'DOCUMENTS-002 · PC-B · REAL VERTICAL SLICE',
      'آرشیو مرکزی فایل نهایی، Metadata',
      'نتیجه عملیات',
      'SavedDocumentView',
      "{ key: 'activity', label: 'فعالیت و گزارش دسترسی'",
      'مسیرهای پیشنهادی برای بررسی',
      'SHA-256 پوشیده',
      'MIME تشخیص‌داده‌شده',
      'منبع سند:',
      'Documents فقط Reference دامنه را نگه می‌دارد',
      'خروجی و پردازش‌ها',
      'حذف منطقی',
      'بررسی و قرنطینه',
      'سلامت آرشیو',
    ])
      expect(source).not.toContain(removedCopy);
    expect(source).toContain('bg-gradient-to-br');
    expect(source).toContain('absolute inset-y-0 start-0 w-1');
    expect(source).toContain('from-sky-50 via-blue-50/85');
    expect(source).toContain('personalView: serverPersonalView');
    expect(source).toContain("url.searchParams.set('document', id)");
    expect(source).toContain('documentsApi.preview');
    expect(source).toContain('URL.revokeObjectURL');
    expect(source).toContain('archiveTools.map');
    expect(source).toContain('onClick={() => openArchiveTool(tool)}');
    expect(source).toContain('setActiveArchiveToolKey(tool.key)');
    expect(source).toContain("setSection('archive')");
    expect(source).toContain('بازگشت به ابزارهای مدیریت آرشیو');
    expect(source).toContain('documentOptions.data.branches');
    expect(source).toContain('validateDocumentUpload');
    expect(source).toContain('sourceRelationId');
    expect(source).not.toContain('label="ماژول مبدأ"');
    expect(source).not.toContain('label="شناسه رکورد مبدأ"');
    expect(source).toContain('z-[70] max-h-72');
    expect(source).not.toContain('documentsApi.sessionContext');
    expect(source).not.toContain('dangerouslySetInnerHTML');
  });

  it('submits record operations as forms with visible Persian validation', () => {
    expect(bulkDialogSource).toContain('<form');
    expect(bulkDialogSource).toContain('type="submit"');
    expect(bulkDialogSource).toContain('حداقل ۵ نویسه');
    expect(deleteDialogSource).toContain('<form');
    expect(deleteDialogSource).toContain('type="submit"');
    expect(deleteDialogSource).toContain('کد آرشیو واردشده');
    expect(editDialogSource).toContain("description: description ?? ''");
    expect(editDialogSource).toContain("validUntil: validUntil ?? ''");
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
