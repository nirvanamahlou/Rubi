import { afterEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { ConfigService } from '@nestjs/config';
import { join } from 'node:path';
import {
  HotelImagesController,
  hotelImageWebp,
} from './hotel-images.controller';
import type { AuthenticatedRequest } from '../iam/iam.types';
import type { UploadedDocumentFile } from '../documents/documents.service';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((dir) => rm(dir, { recursive: true, force: true })),
  );
});
const png = () =>
  sharp({ create: { width: 5, height: 7, channels: 3, background: 'red' } })
    .png()
    .toBuffer();
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'hotel-images-'));
  directories.push(root);
  const controller = new HotelImagesController({
    getOrThrow: () => root,
  } as unknown as ConfigService);
  const file = { buffer: await png() } as UploadedDocumentFile;
  const request = {
    actor: { permissions: ['master_data.create'] },
  } as unknown as AuthenticatedRequest;
  return { controller, file, request };
}
describe('Hotel public images', () => {
  it('converts actual image bytes to WebP', async () => {
    expect(
      await sharp(await hotelImageWebp(await png())).metadata(),
    ).toMatchObject({ format: 'webp', width: 5, height: 7 });
  });
  it('rejects invalid file contents', async () => {
    await expect(hotelImageWebp(Buffer.from('not an image'))).rejects.toThrow();
  });
  it('uploads six images and reads the stored WebP without an actor', async () => {
    const { controller, file, request } = await fixture();
    const uploaded = await controller.upload(Array(6).fill(file), request);
    expect(uploaded.data).toHaveLength(6);
    const response = await controller.image(uploaded.data[0]!);
    expect(
      (await controller.image(uploaded.data[0]!, '1')).getHeaders().disposition,
    ).toContain('attachment');
    const chunks: Buffer[] = [];
    for await (const chunk of response.getStream()) chunks.push(chunk);
    expect((await sharp(Buffer.concat(chunks)).metadata()).format).toBe('webp');
    await expect(controller.upload([file], request)).resolves.toEqual({
      data: [uploaded.data[0]],
    });
  });
  it('rejects seven images, unauthorized writes and invalid paths', async () => {
    const { controller, file, request } = await fixture();
    await expect(
      controller.upload(Array(7).fill(file), request),
    ).rejects.toThrow();
    await expect(
      controller.upload([file], {
        actor: { permissions: [] },
      } as unknown as AuthenticatedRequest),
    ).rejects.toThrow();
    await expect(controller.image('../secret')).rejects.toThrow();
  });
});
