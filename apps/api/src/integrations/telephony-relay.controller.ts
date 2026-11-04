import {
  Body,
  type CanActivate,
  Controller,
  type ExecutionContext,
  Inject,
  Injectable,
  Post,
  UnauthorizedException,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import type { TelephonyEventV1 } from '@nora/contracts';
import { TelephonyIntegrationService } from './telephony.service';

/** Optional trusted canonical publisher, never a guessed Issabel webhook. */
@Injectable()
export class TelephonyRelayGuard implements CanActivate {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext) {
    const secret = this.config.get<string>('TELEPHONY_RELAY_SECRET') ?? '';
    const header = context.switchToHttp().getRequest<Request>()
      .headers.authorization;
    const supplied = header?.startsWith('Bearer ') ? header.slice(7) : '';
    if (
      this.config.get<string>('TELEPHONY_RELAY_ENABLED') !== 'true' ||
      secret.length < 32 ||
      [
        'TELEPHONY_WORKER_SECRET',
        'ISSABEL_RECORDING_UPLOAD_SECRET',
        'ISSABEL_AMI_SECRET',
      ].some((key) => secret === this.config.get<string>(key)) ||
      Buffer.byteLength(secret) !== Buffer.byteLength(supplied) ||
      !timingSafeEqual(Buffer.from(secret), Buffer.from(supplied))
    )
      throw new UnauthorizedException();
    return true;
  }
}
@Controller('internal/telephony-relay')
@UseGuards(TelephonyRelayGuard)
export class TelephonyRelayController {
  constructor(
    @Inject(TelephonyIntegrationService)
    private readonly service: TelephonyIntegrationService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}
  @Post('events')
  event(@Body() input: unknown) {
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      !('connectionId' in input) ||
      input.connectionId !==
        this.config.get<string>('TELEPHONY_RELAY_CONNECTION_ID')
    )
      throw new BadRequestException('Invalid relay connection.');
    return this.service.receive(input as TelephonyEventV1, 'RELAY');
  }
}
