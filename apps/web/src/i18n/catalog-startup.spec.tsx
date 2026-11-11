import { renderToPipeableStream, renderToString } from 'react-dom/server';
import { PassThrough } from 'node:stream';
import { useTranslations } from 'next-intl';
import { expect, it, vi } from 'vitest';

vi.unmock('./translate');

const catalogModuleLoaded = vi.hoisted(() => vi.fn());
vi.mock('./en-catalog.json', () => {
  catalogModuleLoaded();
  return { default: { 'برچسب آزمون بارگذاری': 'Catalog startup test' } };
});
vi.mock('@/messages/fa', () => ({
  faMessages: { test: { label: 'برچسب آزمون بارگذاری' } },
}));

function Label() {
  return useTranslations('test')('label');
}

it('loads the English catalog only for English rendering and reuses it', async () => {
  const { Providers } = await import('@/components/providers');
  const render = (initialLanguage: 'fa' | 'en') => (
    <Providers initialLanguage={initialLanguage}>
      <Label />
    </Providers>
  );
  expect(catalogModuleLoaded).not.toHaveBeenCalled();
  expect(renderToString(render('fa'))).toContain('برچسب آزمون بارگذاری');
  expect(catalogModuleLoaded).not.toHaveBeenCalled();

  const html = await new Promise<string>((resolve, reject) => {
    const destination = new PassThrough();
    let output = '';
    destination.setEncoding('utf8');
    destination.on('data', (chunk: string) => {
      output += chunk;
    });
    destination.on('end', () => resolve(output));
    destination.on('error', reject);
    const stream = renderToPipeableStream(render('en'), {
      onAllReady: () => stream.pipe(destination),
      onError: reject,
    });
  });
  expect(html).toContain('Catalog startup test');
  expect(renderToString(render('en'))).toContain('Catalog startup test');
  expect(catalogModuleLoaded).toHaveBeenCalledOnce();
});
