'use client';
import NextImage, { type ImageProps } from 'next/image';
import { useUiTranslation } from './locale-context';

export default function Image({ alt, title, ...props }: ImageProps) {
  const t = useUiTranslation();
  return (
    <NextImage
      {...props}
      alt={t(alt)}
      title={title === undefined ? undefined : t(title)}
    />
  );
}
