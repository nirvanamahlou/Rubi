import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Headers,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { assertManualApiAccess } from '../iam/manual-api-access';
const paths: Record<string, string> = {
  calendar: '/workbench/calendar',
  notes: '/workbench/notes',
  procurement: '/workbench/procurement-follow-ups',
};
@UseGuards(AuthGuard)
@Controller('iam/auth')
export class AssistantReadAccessController {
  @Get('access')
  @Header('Cache-Control', 'private, no-store')
  access(
    @Req() request: AuthenticatedRequest,
    @Headers('x-assistant-source') source?: unknown,
  ) {
    if (source !== undefined) {
      if (typeof source !== 'string' || !Object.hasOwn(paths, source))
        throw new BadRequestException('ASSISTANT_FIXED_SCOPE');
      assertManualApiAccess(request.actor, paths[source]!, 'GET');
    }
    return request.actor;
  }
}
