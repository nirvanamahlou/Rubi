import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsxDEV } from './jsx-dev-runtime';
import { DisplayLocaleContext } from './locale-context';

function Provider({ children }: { children: ReactNode }) {
  return createElement(
    DisplayLocaleContext.Provider,
    { value: 'en' },
    children,
  );
}

function element(tag: 'a' | 'span', text: string, key?: string) {
  return jsxDEV(tag, { children: text }, key, false, undefined, undefined);
}

afterEach(() => vi.restoreAllMocks());

describe('localized development JSX children', () => {
  it('preserves static siblings from the root layout without a missing-key warning', () => {
    const errors = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const children = [element('a', 'ذخیره'), element('span', 'Main content')];
    const tree = jsxDEV(
      Provider,
      { children },
      undefined,
      true,
      undefined,
      undefined,
    );
    const html = renderToStaticMarkup(tree);
    expect(html).toContain('Save');
    expect(html).toContain('Main content');
    expect(errors).not.toHaveBeenCalled();
    expect(Object.isFrozen(children)).toBe(false);
  });

  it('still warns for a genuine dynamic list without keys', () => {
    const errors = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const tree = jsxDEV(
      'section',
      { children: [element('span', 'Dynamic entry')] },
      undefined,
      false,
      undefined,
      undefined,
    );
    renderToStaticMarkup(tree);
    expect(errors.mock.calls.flat().join(' ')).toContain('unique "key"');
  });

  it('preserves explicit keys, refs and handlers on localized elements', () => {
    const onClick = () => undefined;
    const ref = { current: null };
    const tree = jsxDEV(
      'a',
      { 'aria-label': 'ذخیره', children: 'ذخیره', onClick, ref },
      'saved-entry',
      false,
      undefined,
      undefined,
    );
    expect(tree.key).toBe('saved-entry');
    expect((tree.props as Record<string, unknown>).onClick).toBe(onClick);
    expect((tree.props as Record<string, unknown>).ref).toBe(ref);
    expect(renderToStaticMarkup(createElement(Provider, null, tree))).toContain(
      'aria-label="Save"',
    );
  });
});
