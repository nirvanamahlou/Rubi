import {
  Body,
  Controller,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../iam/auth.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { PermissionGuard } from '../iam/permission.guard';
// Runtime DTO imports are required for ValidationPipe metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  CreateB2bPhoneChallengeDto,
  CreateVerifiedB2bContactDto,
  VerifyB2bPhoneChallengeDto,
} from './b2b-phone-verification.dto';
import { B2bPhoneVerificationService } from './b2b-phone-verification.service';

@ApiTags('B2B Cooperation Phone Verification')
@ApiCookieAuth('nora_access')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermissions('master_data.read', 'master_data.create')
@Controller('b2b/cooperation/phone-verification')
export class B2bPhoneVerificationController {
  constructor(
    @Inject(B2bPhoneVerificationService)
    private readonly service: B2bPhoneVerificationService,
  ) {}

  @Post('challenges')
  @Header('Cache-Control', 'no-store')
  challenge(
    @Body() dto: CreateB2bPhoneChallengeDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.challenge(dto, request.actor);
  }

  @Post('challenges/:challengeId/verify')
  @Header('Cache-Control', 'no-store')
  verify(
    @Param('challengeId', new ParseUUIDPipe()) challengeId: string,
    @Body() dto: VerifyB2bPhoneChallengeDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.verify(challengeId, dto, request.actor);
  }

  @Post('contacts')
  @Header('Cache-Control', 'no-store')
  contact(
    @Body() dto: CreateVerifiedB2bContactDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createVerifiedContact(dto, request.actor);
  }
}
