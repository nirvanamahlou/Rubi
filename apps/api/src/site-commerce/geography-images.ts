import { BadRequestException } from '@nestjs/common';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  publicMasterDataImageRoot,
  uploadedMasterDataImageName,
} from '../master-data/public-image-storage';

type GeographyImages = {
  mainImage?: string | null;
  galleryImages?: string[];
};

async function encodeGeographyImage(
  root: string,
  path: string,
): Promise<string> {
  try {
    const name = uploadedMasterDataImageName(path);
    const file = await open(join(root, name));
    let buffer: Buffer;
    try {
      if ((await file.stat()).size > 20_000_000)
        throw new Error('Stored image exceeds limit');
      buffer = await file.readFile();
    } finally {
      await file.close();
    }
    const image = sharp(buffer, { limitInputPixels: 40_000_000 });
    const metadata = await image.metadata();
    if (metadata.format !== 'webp' || (metadata.pages ?? 1) > 1)
      throw new Error('Invalid stored image');
    for (const [width, height, quality] of [
      [1280, 960, 75],
      [960, 720, 65],
      [640, 480, 55],
    ] as const) {
      const resized = await image
        .clone()
        .resize({ width, height, fit: 'inside', withoutEnlargement: true })
        .webp({ quality })
        .toBuffer();
      if (resized.length <= 375_000) return resized.toString('base64');
    }
    throw new Error('Compressed image exceeds publication limit');
  } catch {
    throw new BadRequestException(
      'آماده‌سازی یکی از عکس‌های مقصد برای انتشار انجام نشد. عکس را دوباره بارگذاری کنید.',
    );
  }
}

export async function geographyPublicationImages(
  attributes: Record<string, unknown>,
  storageRoot: string | undefined,
): Promise<GeographyImages> {
  const { sourceMainImage, sourceGalleryImages } = attributes;
  const result: GeographyImages = {};
  async function encode(path: string) {
    if (!storageRoot)
      throw new BadRequestException('سرویس عکس مقصد در دسترس نیست.');
    return encodeGeographyImage(publicMasterDataImageRoot(storageRoot), path);
  }
  if (typeof sourceMainImage === 'string')
    result.mainImage = sourceMainImage ? await encode(sourceMainImage) : null;
  if (typeof sourceGalleryImages === 'string') {
    result.galleryImages = [];
    if (sourceGalleryImages)
      for (const path of sourceGalleryImages.split('|'))
        result.galleryImages.push(await encode(path));
  }
  return result;
}
