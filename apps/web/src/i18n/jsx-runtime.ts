import {
  jsx as reactJsx,
  jsxs as reactJsxs,
  Fragment,
} from 'react/jsx-runtime';
import { LocalizedElement, LocalizedText } from './localized-text';

export { Fragment };
export type { JSX } from 'react/jsx-runtime';

const persian = /[\u0600-\u06ff]/;
const attributes = [
  'title',
  'placeholder',
  'alt',
  'aria-label',
  'aria-description',
  'aria-valuetext',
];
const verbatimTags = new Set(['script', 'style', 'title', 'textarea']);

function localizedChildren(children: unknown, index?: number): unknown {
  if (typeof children === 'string' && persian.test(children))
    return reactJsx(
      LocalizedText,
      { children },
      index === undefined ? undefined : `localized-text-${index}`,
    );
  if (Array.isArray(children))
    return children.map((child, i) => localizedChildren(child, i));
  return children;
}

type Factory = typeof reactJsx;

function localize(
  factory: Factory,
  type: Parameters<Factory>[0],
  props: Parameters<Factory>[1],
  key?: Parameters<Factory>[2],
) {
  if (
    !props ||
    typeof props !== 'object' ||
    (typeof type === 'string' && verbatimTags.has(type))
  )
    return factory(type, props, key);
  const input = props as Record<string, unknown>;
  const localized: Record<string, unknown> = {
    ...input,
    children: localizedChildren(input.children),
  };
  if (
    typeof type === 'string' &&
    type !== 'html' &&
    type !== 'body' &&
    (typeof localized.dir === 'string' ||
      attributes.some((name) => typeof localized[name] === 'string'))
  )
    return factory(LocalizedElement, { ...localized, tag: type }, key);
  return factory(type, localized, key);
}

export const jsx: Factory = (type, props, key) =>
  localize(reactJsx, type, props, key);
export const jsxs: Factory = (type, props, key) =>
  localize(reactJsxs, type, props, key);
