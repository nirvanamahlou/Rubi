import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DisplayLocaleContext } from '@/i18n/locale-context';
import { CompanyLogos } from './login-company-logos';

describe('login company logos', () => {
  for (const language of ['fa', 'en'] as const) {
    for (const compact of [false, true]) {
      it(`retains both actual images in ${language}, compact=${compact}`, () => {
        const html = renderToStaticMarkup(
          createElement(
            DisplayLocaleContext.Provider,
            { value: language },
            createElement(CompanyLogos, { compact }),
          ),
        );
        expect(html.match(/<img\b/g)).toHaveLength(2);
        expect(html).toContain('niyayesh-seir-full.png');
        expect(html).toContain('jahan-bastan.png');
        expect(html).toContain(compact ? 'h-32' : 'h-48');
        expect(
          html.split(compact ? 'object-contain p-1' : 'object-contain p-2'),
        ).toHaveLength(3);
        expect(html).not.toContain('Travel agency');
        expect(html).toContain(
          language === 'en'
            ? 'alt="Niayesh Seir company logo"'
            : 'alt="لوگوی شرکت نیایش سیر"',
        );
      });
    }
  }
});
