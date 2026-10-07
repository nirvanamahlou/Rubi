import type { createElement as reactCreateElement, ElementType, ReactNode } from 'react';
import { jsx } from './jsx-runtime';

export { Fragment } from 'react';

/** Automatic JSX uses createElement when a key precedes a spread. */
export const createElement: typeof reactCreateElement = ((
  type: ElementType,
  props: Record<string, unknown> | null,
  ...children: ReactNode[]
) => {
  const input = { ...props };
  if (children.length) input.children = children.length === 1 ? children[0] : children;
  const key = input.key as string | undefined;
  delete input.key;
  return jsx(type, input, key);
}) as typeof reactCreateElement;
