import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Image from './image';
import { DisplayLocaleContext } from './locale-context';
import { legalEntityBrand } from '@/modules/legal-entities/model/context';

describe('localized image identity', () => {
  it.each([
    'NIYAYESH_SEIR_SAHAR',
    'JAHAN_BASTAN',
    'JAHAN_ACADEMIA',
    'GHESATI_RO',
  ] as const)('preserves %s branding across locale changes', (selection) => {
    const brand = legalEntityBrand(selection);
    const outputs = (['fa', 'en'] as const).map((language) =>
      renderToStaticMarkup(
        createElement(
          DisplayLocaleContext.Provider,
          { value: language },
          createElement(Image, {
            src: brand.src,
            alt: brand.alt,
            title: brand.alt,
            width: brand.width,
            height: brand.height,
          }),
        ),
      ),
    );
    for (const html of outputs) expect(html).toContain('<img');
    const attributes = (html: string) =>
      html.match(/(?:src|srcSet|width|height)="[^"]*"/g);
    expect(attributes(outputs[0]!)).toEqual(attributes(outputs[1]!));
    expect(outputs[0]).toContain(brand.alt);
    expect(outputs[1]).not.toContain(brand.alt);
  });
});
