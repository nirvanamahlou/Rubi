import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { useTranslations } from 'next-intl';
import { expect, it, vi } from 'vitest';

const catalogRead = vi.hoisted(() => vi.fn());
vi.mock('./en-catalog.json', () => ({
  default: {
    get 'برچسب آزمون بارگذاری'() {
      catalogRead();
      return 'Catalog startup test';
    },
  },
}));
vi.mock('@/messages/fa', () => ({
  faMessages: { test: { label: 'برچسب آزمون بارگذاری' } },
}));

function Label() {
  return useTranslations('test')('label');
}

it('leaves the English catalog unmerged for Persian and reuses it after English first renders', async () => {
  const { Providers } = await import('@/components/providers');
  const render = (initialLanguage: 'fa' | 'en') =>
    renderToString(
      createElement(Providers, {
        initialLanguage,
        children: createElement(Label),
      }),
    );

  expect(catalogRead).not.toHaveBeenCalled();
  expect(render('fa')).toContain('برچسب آزمون بارگذاری');
  expect(catalogRead).not.toHaveBeenCalled();
  expect(render('en')).toContain('Catalog startup test');
  expect(render('en')).toContain('Catalog startup test');
  expect(catalogRead).toHaveBeenCalledOnce();
});
