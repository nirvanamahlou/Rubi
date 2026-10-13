import { createElement, isValidElement, type ReactNode } from 'react';
import { LocalizedElement, LocalizedText } from './localized-text';

/** Inspect canonical props in callback tests; actual locale rendering has SSR tests. */
export function canonicalTestTree(node: ReactNode): ReactNode {
  if (Array.isArray(node)) return node.map(canonicalTestTree);
  if (!isValidElement<Record<string, unknown>>(node)) return node;
  if (node.type === LocalizedText) return node.props.children as string;
  const { children, tag, ...props } = node.props;
  return createElement(
    node.type === LocalizedElement ? (tag as string) : node.type,
    props,
    canonicalTestTree(children as ReactNode),
  );
}
