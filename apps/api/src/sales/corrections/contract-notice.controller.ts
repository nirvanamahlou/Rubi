import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../iam/auth.guard';
import type { AuthenticatedRequest } from '../../iam/iam.types';
import { ContractNoticeService } from './contract-notice.service';
@Controller('sales/contracts')
@UseGuards(AuthGuard)
export class ContractNoticeController {
  constructor(
    @Inject(ContractNoticeService)
    private readonly service: ContractNoticeService,
  ) {}
  @Get(':id/notice')
  @Header('Cache-Control', 'private, no-store')
  read(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.read(id, req.actor);
  }
  @Patch(':id/notice')
  @Header('Cache-Control', 'private, no-store')
  save(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.save(id, input, req.actor);
  }
}
