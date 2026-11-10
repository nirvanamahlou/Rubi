import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../../iam/auth.guard';
import type { AuthenticatedRequest } from '../../iam/iam.types';
import { InsuranceAutomation } from './insurance-automation';
import { StandaloneInsuranceService } from './standalone-insurance.service';

@Controller('reservations/insurance/standalone')
@UseGuards(AuthGuard)
export class StandaloneInsuranceController {
  constructor(
    @Inject(StandaloneInsuranceService)
    private readonly insurance: StandaloneInsuranceService,
    @Inject(InsuranceAutomation)
    private readonly automation: InsuranceAutomation,
  ) {}
  @Post()
  @Header('Cache-Control', 'private, no-store')
  async create(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const saved = await this.insurance.save(body, req.actor);
    this.automation.requestImmediate(saved.data.id);
    return saved;
  }
  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  read(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.insurance.read(id, req.actor);
  }
  @Put(':id')
  @Header('Cache-Control', 'private, no-store')
  async save(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const saved = await this.insurance.save(body, req.actor, id);
    this.automation.requestImmediate(saved.data.id);
    return saved;
  }
  @Get(':id/pdf')
  @Header('Cache-Control', 'private, no-store')
  async pdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.insurance.pdf(id, req.actor);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(result.bytes, { type: result.type });
  }
}
