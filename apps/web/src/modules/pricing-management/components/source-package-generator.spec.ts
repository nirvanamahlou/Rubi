import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = resolve(process.cwd(), 'public/package-generator');

function sourceFiles(directory = sourceRoot): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });
}

describe('source package generator archive', () => {
  it('keeps every file from the supplied archive', () => {
    const files = sourceFiles();

    expect(files).toHaveLength(119);
    expect(files.some((path) => path.endsWith('iran air.png'))).toBe(false);
    expect(
      statSync(resolve(sourceRoot, 'installment-assets.js')).size,
    ).toBeGreaterThan(60 * 1024 * 1024);
  });

  it('loads the complete offline editor dependency graph', () => {
    const html = readFileSync(resolve(sourceRoot, 'index.html'), 'utf8');
    const loader = readFileSync(resolve(sourceRoot, 'mode-loader.js'), 'utf8');

    expect(html).toContain('پکیج‌ساز | قالب‌های اصلی سفر');
    expect(html).toContain('vendor/fflate.js');
    expect(html).toContain('vendor/html2canvas.js');
    expect(html).toContain('vendor/jspdf.js');
    expect(html).toContain('mode-loader.js');
    expect(loader).toContain("'banner.js'");
    expect(loader).toContain("'sticker.js'");
    expect(html).toContain('editor-ui.js');
    expect(html).toContain('accept=".xlsx,.docx"');
  });

  it('contains the package, banner and sticker modes from the source', () => {
    const loader = readFileSync(resolve(sourceRoot, 'mode-loader.js'), 'utf8');
    const banner = readFileSync(resolve(sourceRoot, 'banner.js'), 'utf8');
    const sticker = readFileSync(resolve(sourceRoot, 'sticker.js'), 'utf8');

    expect(loader).toContain('پکیج جدولی / ترکیبی');
    expect(loader).toContain('بنر تصویری');
    expect(loader).toContain('تولید استیکر');
    expect(banner).toContain("setMode('banner')");
    expect(sticker).toContain("setMode('sticker')");
  });
});
