'use client';
import NextLink from 'next/link';
import type { ComponentPropsWithRef } from 'react';
import { useUiTranslation } from './locale-context';

export default function Link({ title, 'aria-label': label, ...props }: ComponentPropsWithRef<typeof NextLink>) {
  const t = useUiTranslation();
  return <NextLink {...props} title={title === undefined ? undefined : t(title)} aria-label={label === undefined ? undefined : t(label)} />;
}
