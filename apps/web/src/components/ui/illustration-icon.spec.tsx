import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { IllustrationIcon } from './illustration-icon';

it('renders repeated illustrations with unique local gradients and decorative semantics', () => {
  const html = renderToStaticMarkup(
    <>
      <IllustrationIcon kind="headset" />
      <IllustrationIcon kind="headset" />
    </>,
  );
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  expect(new Set(ids).size).toBe(ids.length);
  for (const match of html.matchAll(/url\(#([^)]+)\)/g))
    expect(ids).toContain(match[1]);
  expect(html.match(/aria-hidden="true"/g)).toHaveLength(2);
  expect(html.match(/focusable="false"/g)).toHaveLength(2);
  expect(html).not.toContain('<image');
  expect(html).not.toContain('<title');
});
