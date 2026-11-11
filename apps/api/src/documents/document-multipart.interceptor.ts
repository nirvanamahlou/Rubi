import { createHash, randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { finalize } from 'rxjs';

import { LocalDocumentStorage } from './documents.storage';
import { MAX_DOCUMENT_SIZE_BYTES } from './documents.validation';

export type StagedDocumentFile = {
  originalname: string;
  mimetype: string;
  size: number;
  staged: {
    documentId: string;
    objectKey: string;
    sha256: string;
    prefix: Buffer;
    retained: boolean;
  };
};

@Injectable()
export class DocumentMultipartInterceptor implements NestInterceptor {
  private readonly parser: NestInterceptor;
  private readonly uploads = new WeakMap<object, Promise<StagedDocumentFile>>();
  private readonly logger = new Logger(DocumentMultipartInterceptor.name);

  constructor(
    @Inject(LocalDocumentStorage)
    private readonly storage: LocalDocumentStorage,
  ) {
    const Parser = FileInterceptor('file', {
      limits: { files: 1, fileSize: MAX_DOCUMENT_SIZE_BYTES },
      storage: {
        _handleFile: (
          request: object,
          file: Pick<StagedDocumentFile, 'originalname' | 'mimetype'> & {
            stream: Readable;
          },
          done: (error: unknown, file?: StagedDocumentFile) => void,
        ) => {
          const upload = this.stage(file);
          this.uploads.set(request, upload);
          void upload.then(
            (staged) => done(null, staged),
            (error: unknown) => done(error),
          );
        },
        _removeFile: (
          _request: unknown,
          file: StagedDocumentFile,
          done: (error: unknown) => void,
        ) => {
          void this.removeUnretained(file).then(() => done(null), done);
        },
      },
    });
    this.parser = new Parser();
  }

  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context
      .switchToHttp()
      .getRequest<{ file?: StagedDocumentFile }>();
    const cleanup = async () => {
      const upload = this.uploads.get(request);
      this.uploads.delete(request);
      const staged = request.file ?? (await upload?.catch(() => undefined));
      try {
        await this.removeUnretained(staged);
      } catch {
        this.logger.warn('Could not remove an uncommitted document upload.');
      }
    };
    try {
      const response = await this.parser.intercept(context, next);
      return response.pipe(finalize(() => void cleanup()));
    } catch (error) {
      await cleanup();
      throw error;
    }
  }

  private async removeUnretained(file?: StagedDocumentFile) {
    if (file?.staged && !file.staged.retained)
      await this.storage.removeQuarantined(file.staged.objectKey);
  }

  private async stage(
    file: Pick<StagedDocumentFile, 'originalname' | 'mimetype'> & {
      stream: Readable;
    },
  ): Promise<StagedDocumentFile> {
    const documentId = randomUUID();
    const objectKey = `documents/${documentId}/v1/${randomUUID()}.bin`;
    const hash = createHash('sha256');
    const prefix = Buffer.alloc(1024);
    let size = 0;
    async function* contents() {
      for await (const chunk of file.stream) {
        const bytes = chunk as Buffer;
        if (size < prefix.length)
          bytes.copy(prefix, size, 0, prefix.length - size);
        size += bytes.length;
        hash.update(bytes);
        yield bytes;
      }
    }
    await this.storage.putQuarantinedStream(objectKey, contents());
    return {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size,
      staged: {
        documentId,
        objectKey,
        sha256: hash.digest('hex'),
        prefix: prefix.subarray(0, Math.min(size, prefix.length)),
        retained: false,
      },
    };
  }
}
