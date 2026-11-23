import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  Query,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FilesInterceptor } from '@nestjs/platform-express';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { AuthGuard } from '../iam/auth.guard';
import { Public } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import type { UploadedDocumentFile } from '../documents/documents.service';

export async function hotelImageWebp(buffer: Buffer): Promise<Buffer> {
  try {
    const image = sharp(buffer, { limitInputPixels: 40_000_000 });
    const metadata = await image.metadata();
    if (
      !['jpeg', 'png', 'webp'].includes(metadata.format ?? '') ||
      (metadata.pages ?? 1) > 1
    )
      throw new Error('Unsupported image');
    return await image.rotate().webp({ quality: 85 }).toBuffer();
  } catch {
    throw new BadRequestException(
      'عکس باید PNG، JPEG یا WebP معتبر و حداکثر ۴۰ مگاپیکسل باشد.',
    );
  }
}

@Controller('master-data/hotel-images')
@UseGuards(AuthGuard)
export class HotelImagesController {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  private root() {
    return join(
      this.config.getOrThrow<string>('DOCUMENTS_STORAGE_ROOT'),
      'public-hotel-images',
    );
  }

  @Post()
  @UseInterceptors(
    FilesInterceptor('files', 6, {
      limits: { fileSize: 10 * 1024 * 1024, files: 6 },
    }),
  )
  async upload(
    @UploadedFiles() files: UploadedDocumentFile[] | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    if (
      !request.actor.permissions.some(
        (permission) =>
          permission === 'master_data.create' ||
          permission === 'master_data.update',
      )
    )
      throw new ForbiddenException();
    if (!files?.length || files.length > 6)
      throw new BadRequestException('بین یک تا شش عکس انتخاب کنید.');
    const images = await Promise.all(
      files.map((file) => hotelImageWebp(file.buffer)),
    );
    await mkdir(this.root(), { recursive: true });
    const names: string[] = [];
    for (const image of images) {
      const name = createHash('sha256').update(image).digest('hex') + '.webp';
      const temporaryPath = join(this.root(), randomUUID() + '.tmp');
      try {
        await writeFile(temporaryPath, image, { flag: 'wx' });
        await rename(temporaryPath, join(this.root(), name)).catch(
          (error: NodeJS.ErrnoException) => {
            if (error.code !== 'EEXIST') throw error;
          },
        );
      } finally {
        await rm(temporaryPath, { force: true });
      }
      names.push(name);
    }
    return { data: names };
  }

  @Public()
  @Get(':name')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  @Header('X-Content-Type-Options', 'nosniff')
  async image(
    @Param('name') name: string,
    @Query('download') download?: string,
  ) {
    if (!/^[a-f0-9]{64}\.webp$/.test(name)) throw new NotFoundException();
    let bytes: Buffer;
    try {
      bytes = await readFile(join(this.root(), name));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        throw new NotFoundException();
      throw error;
    }
    return new StreamableFile(bytes, {
      type: 'image/webp',
      disposition:
        download === '1' ? `attachment; filename="${name}"` : 'inline',
      length: bytes.length,
    });
  }
}
