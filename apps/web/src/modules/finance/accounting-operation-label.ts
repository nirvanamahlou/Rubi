import { isValidElement, type ReactNode } from 'react';
import { LocalizedText } from '@/i18n/localized-text';

/** The app JSX runtime wraps Persian captions before passing them to components.
 * Read only that documented wrapper; do not infer operations from rendered DOM. */
export function accountingOperationLabel(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(accountingOperationLabel).join('');
  if (
    isValidElement<{ children?: ReactNode }>(node) &&
    node.type === LocalizedText
  )
    return accountingOperationLabel(node.props.children);
  return '';
}
