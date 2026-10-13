'use client';

import { createElement, type HTMLAttributes } from 'react';
import { useDisplayLanguage } from './locale-context';
import { translateUiText } from './translate';

export function LocalizedText({ children }: { children: string }) {
  return translateUiText(children, useDisplayLanguage());
}

const textAttributes = [
  'title',
  'placeholder',
  'alt',
  'aria-label',
  'aria-description',
  'aria-valuetext',
] as const;

export function LocalizedElement({
  tag,
  ...attributes
}: {
  tag: string;
} & Record<string, unknown>) {
  const language = useDisplayLanguage();
  const props = { ...attributes };
  for (const key of textAttributes) {
    const value = props[key];
    if (typeof value === 'string')
      props[key] = translateUiText(value, language);
  }
  if (language === 'en' && props.dir === 'rtl') props.dir = 'ltr';
  return createElement(tag, props as HTMLAttributes<HTMLElement>);
}

export { textAttributes };
