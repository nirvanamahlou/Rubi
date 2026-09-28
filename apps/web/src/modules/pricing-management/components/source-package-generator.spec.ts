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

    expect(files.length).toBeGreaterThanOrEqual(125);
    expect(files.some((path) => path.endsWith('iran air.png'))).toBe(false);
    expect(
      statSync(resolve(sourceRoot, 'installment-assets.js')).size,
    ).toBeGreaterThan(60 * 1024 * 1024);
  });

  it('uses the seven corrected Malaysia and Thailand city templates', () => {
    const templates = readFileSync(
      resolve(sourceRoot, 'malaysia-templates.js'),
      'utf8',
    );
    const app = readFileSync(resolve(sourceRoot, 'app.js'), 'utf8');
    const cards = readFileSync(resolve(sourceRoot, 'cards.js'), 'utf8');
    const editor = readFileSync(resolve(sourceRoot, 'editor.js'), 'utf8');
    const correctedTemplates = [
      ['malaysia-kuala', 'malaysia-kuala.jpg'],
      ['malaysia-penang', 'malaysia-penang.jpg'],
      ['malaysia-singapore', 'malaysia-singapore.jpg'],
      ['malaysia-langkawi', 'malaysia-langkawi.jpg'],
      ['thailand-phuket', 'thailand-phuket.jpg'],
      ['thailand-bangkok-phuket', 'thailand-bangkok-phuket.jpg'],
      ['thailand-pattaya', 'thailand-pattaya.jpg'],
    ] as const;

    for (const [templateId, fileName] of correctedTemplates) {
      expect(templates).toContain(`image:'${fileName}'`);
      expect(statSync(resolve(sourceRoot, fileName)).size).toBeGreaterThan(
        100 * 1024,
      );
      expect(app).toContain(`'${templateId}':{left:`);
      expect(cards).toContain(`'${templateId}':{band:`);
      expect(editor).toContain(`'${templateId}':{subtitle:`);
    }
    expect(templates).toContain('externalImage:true');
    expect(
      sourceFiles().some((path) => path.endsWith('malaysia-assets.js')),
    ).toBe(false);
    expect(
      sourceFiles().some((path) => path.endsWith('thailand-phuket.png')),
    ).toBe(false);
  });

  it('registers both Istanbul artworks and the matching Excel price columns', () => {
    const templates = readFileSync(
      resolve(sourceRoot, 'istanbul-templates.js'),
      'utf8',
    );
    const app = readFileSync(resolve(sourceRoot, 'app.js'), 'utf8');
    const parser = readFileSync(resolve(sourceRoot, 'pkj.js'), 'utf8');
    const html = readFileSync(resolve(sourceRoot, 'index.html'), 'utf8');

    for (const [templateId, artwork] of [
      ['istanbul-3', 'istanbul-3.png'],
      ['istanbul-4', 'istanbul-4.png'],
    ] as const) {
      expect(templates).toContain(`TEMPLATES['${templateId}']`);
      expect(templates).toContain(`image:'${artwork}'`);
      expect(statSync(resolve(sourceRoot, artwork)).size).toBeGreaterThan(
        100 * 1024,
      );
      expect(app).toContain(`'${templateId}'`);
    }
    expect(templates).toContain('columns:[31,18,12,12,13,14]');
    expect(templates).toContain('columns:[30,19,17,17,17]');
    expect(parser).toContain("cols.extra?'istanbul-3':'istanbul-4'");
    expect(parser).toContain(
      'if(istanbul&&!cols.service)cols.service=cols.room',
    );
    expect(parser).toContain("'chwbed'");
    expect(html).toContain('istanbul-templates.js');
    expect(html).toContain('istanbul.css');
  });

  it('offers the supplied Istanbul poster in banner mode with four editable hotel cards', () => {
    const template = readFileSync(resolve(sourceRoot, 'istanbul-banner.js'), 'utf8');
    const loader = readFileSync(resolve(sourceRoot, 'mode-loader.js'), 'utf8');
    const renderer = readFileSync(resolve(sourceRoot, 'banner-reference.js'), 'utf8');

    expect(statSync(resolve(sourceRoot, 'istanbul-banner.png')).size).toBeGreaterThan(1024 * 1024);
    expect(loader).toContain("'istanbul-banner.js?v=20260928b'");
    expect(template).toContain('BANNER_TEMPLATES.istanbul_promo');
    expect(template).toContain("image:'istanbul-banner.png'");
    expect(template).toContain('preserveOriginalCards:true');
    expect(template).toContain('hotels:cards.map');
    expect(renderer).toContain('p.preserveOriginalCards&&!h.dirty');
  });

  it('fits Malaysia and Thailand data to each corrected poster layout', () => {
    const templates = readFileSync(
      resolve(sourceRoot, 'malaysia-templates.js'),
      'utf8',
    );
    const app = readFileSync(resolve(sourceRoot, 'app.js'), 'utf8');
    const cards = readFileSync(resolve(sourceRoot, 'cards.js'), 'utf8');
    const parser = readFileSync(resolve(sourceRoot, 'pkj.js'), 'utf8');
    const html = readFileSync(resolve(sourceRoot, 'index.html'), 'utf8');

    expect(templates).toContain('fixedCardSlots:true');
    expect(templates).toContain('tableColumns:2');
    expect(templates).toContain(
      'bodyColumns:[[140,195,281,593],[423,195,282,593]]',
    );
    expect(app).toContain('p.rows*(p.tableColumns||1)');
    expect(app).toContain('splitTableColumns(ids,p.tableColumns||1)');
    expect(cards).toContain('base().fixedCardSlots');
    expect(parser).toContain(
      "'phuket','thailand','bangkok','pattaya','hkt','bkk'",
    );
    expect(parser).toContain("template==='thailand-bangkok-phuket'");
    expect(html).toContain('خودکار · مطابق ظرفیت قالب');
  });

  it('loads the complete offline editor dependency graph', () => {
    const html = readFileSync(resolve(sourceRoot, 'index.html'), 'utf8');
    const loader = readFileSync(resolve(sourceRoot, 'mode-loader.js'), 'utf8');

    expect(html).toContain('پکیج‌ساز | قالب‌های اصلی سفر');
    expect(html).toContain('vendor/fflate.js');
    expect(html).toContain('vendor/html2canvas.js');
    expect(html).toContain('vendor/jspdf.js');
    expect(html).toContain('mode-loader.js');
    expect(loader).toContain("'banner.js?v=20260928b'");
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
