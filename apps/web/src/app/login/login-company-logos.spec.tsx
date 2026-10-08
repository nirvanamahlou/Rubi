import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DisplayLocaleContext } from '@/i18n/locale-context';
import { CompanyLogos } from './login-company-logos';

describe('login company branding', () => {
  for (const language of ['fa', 'en'] as const) {
    for (const compact of [false, true]) {
      it(`preserves both logo images in ${language}, compact=${compact}`, () => {
        const html = renderToStaticMarkup(
          createElement(
            DisplayLocaleContext.Provider,
            { value: language },
            createElement(CompanyLogos, { compact }),
          ),
        );
        expect(html.match(/<img\b/g)).toHaveLength(2);
        expect(html).toContain('niyayesh-seir-full.png');
        expect(html).toContain('jahan-bastan-transparent.png');
        expect(html).not.toContain('Travel agency');
      });
    }
  }
});
