import {
  Controller,
  Get,
  Post,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../../iam/auth.guard';
import type { AuthenticatedRequest } from '../../iam/iam.types';
import { InsuranceAutomation } from './insurance-automation';

@Controller('reservations/requests/:intakeId/insurance')
@UseGuards(AuthGuard)
export class InsuranceDocumentsController {
  constructor(
    @Inject(InsuranceAutomation)
    private readonly insurance: InsuranceAutomation,
  ) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  summary(
    @Param('intakeId', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.insurance.summary(id, req.actor);
  }
  @Get('pdf/:policyId')
  @Header('Cache-Control', 'private, no-store')
  async pdf(
    @Param('intakeId', ParseUUIDPipe) id: string,
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.insurance.download(id, req.actor, policyId);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(result.bytes, { type: result.type });
  }
  @Post('prepare')
  prepare(
    @Param('intakeId', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.insurance.prepare(id, req.actor);
  }
}
