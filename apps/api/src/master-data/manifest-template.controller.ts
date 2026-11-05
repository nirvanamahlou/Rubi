import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { normalizeManifestTemplate } from '../common/manifest/workbook-template';
@Controller('master-data/manifest-template-files')
@UseGuards(AuthGuard)
export class ManifestTemplateController {
  @Post('prepare')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 0 },
    }),
  )
  prepare(
    @UploadedFile() file: { buffer: Buffer; originalname: string } | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    if (
      !request.actor.permissions.some(
        (p) => p === 'master_data.create' || p === 'master_data.update',
      )
    )
      throw new ForbiddenException();
    if (!file || !/\.xls[xm]$/i.test(file.originalname))
      throw new BadRequestException('MANIFEST_TEMPLATE_INVALID');
    let result: ReturnType<typeof normalizeManifestTemplate>;
    try {
      result = normalizeManifestTemplate(file.buffer);
    } catch (reason) {
      if (reason instanceof BadRequestException) throw reason;
      throw new BadRequestException('MANIFEST_TEMPLATE_INVALID');
    }
    return {
      data: {
        fileName: file.originalname.replace(/\.xlsm$/i, '.xlsx'),
        contentBase64: Buffer.from(result.bytes).toString('base64'),
        sheetName: result.sheetName,
        columns: result.headers,
        ageCodes: result.ageCodes,
      },
    };
  }
}
