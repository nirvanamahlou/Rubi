import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

type GalleryField = {
  id: string;
  label: string;
  box: [number, number, number, number];
  kind?: string;
};
type GalleryTemplate = {
  country: string;
  width: number;
  height: number;
  image: string;
  fields: GalleryField[];
};
const root = resolve(process.cwd(), 'public/package-generator');
const context = { window: { TEMPLATES: {}, PackageGalleryTemplates: {} } };
runInNewContext(
  readFileSync(resolve(root, 'package-gallery-templates.js'), 'utf8'),
  context,
);
const templates = context.window.PackageGalleryTemplates as Record<
  string,
  GalleryTemplate
>;
function getTemplate(id: string): GalleryTemplate {
  const template = templates[id];
  if (!template) throw new Error(`Missing template: ${id}`);
  return template;
}

describe('supplied editable package artwork', () => {
  it('offers six distinct designs under the correct countries', () => {
    expect(
      Object.entries(templates).map(([id, template]) => [id, template.country]),
    ).toEqual([
      ['package-kish', 'iran'],
      ['package-qeshm', 'iran'],
      ['package-mashhad', 'iran'],
      ['package-vietnam', 'vietnam'],
      ['package-vietnam-luxury', 'vietnam'],
      ['package-china', 'china'],
    ]);
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');
    for (const country of new Set(
      Object.values(templates).map((template) => template.country),
    )) {
      expect(html).toContain(`value="${country}"`);
    }
  });

  it.each(Object.entries(templates))(
    '%s keeps each editable area inside its original artwork',
    (_id, template) => {
      const ids = template.fields.map((field) => field.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(template.fields.some((field) => field.kind === 'image')).toBe(
        true,
      );
      for (const field of template.fields) {
        const [x, y, width, height] = field.box;
        expect(field.label).not.toBe('');
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(width).toBeGreaterThan(0);
        expect(height).toBeGreaterThan(0);
        expect(x + width).toBeLessThanOrEqual(template.width);
        expect(y + height).toBeLessThanOrEqual(template.height);
      }
    },
  );

  it('keeps the two-page references landscape and the hotel references portrait', () => {
    for (const id of ['package-china', 'package-vietnam-luxury']) {
      expect(getTemplate(id).width).toBeGreaterThan(getTemplate(id).height);
    }
    for (const id of ['package-kish', 'package-qeshm', 'package-mashhad']) {
      expect(getTemplate(id).height).toBeGreaterThan(getTemplate(id).width);
    }
  });

  it('preserves the supplied image bytes rather than recreating the posters', () => {
    const expected: Record<string, string> = {
      'package-china':
        '69e61c95a7f8d74bc90343c1380fee46f59854aed592027a6c01f66ac2cdb9f2',
      'package-kish':
        'f80f82d14d28a00fdb518a5c7f7993942258d543bfdd6e1b51c5b5464af76fa7',
      'package-mashhad':
        '6af406fa52e33737a17195780db63e111b207abf3746c6c68a443da4ac626861',
      'package-qeshm':
        'ed81dabd262c1d0cd3347ddca587d3bbbd22f21eb5ad8c30c5c10cb7615f2306',
      'package-vietnam-luxury':
        'bb76ab5bfd3a164c9e39d4e946a51625ec277cefc8d1227975d41bbcf78253c0',
      'package-vietnam':
        '4db6d1313715f3c5bce4e6e02f2b9856cd26b193ff0529ce59514e59145ba70a',
    };
    for (const [id, hash] of Object.entries(expected)) {
      expect(
        createHash('sha256')
          .update(readFileSync(resolve(root, getTemplate(id).image)))
          .digest('hex'),
      ).toBe(hash);
    }
  });
});
