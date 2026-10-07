import { isValidElement, type ReactNode } from 'react';
import { LocalizedText } from './localized-text';

/** Read the canonical action label before choosing an icon or permission. */
export function sourceUiText(node: ReactNode): string | null {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return isValidElement<{ children: string }>(node) && node.type === LocalizedText
    ? node.props.children
    : null;
}
