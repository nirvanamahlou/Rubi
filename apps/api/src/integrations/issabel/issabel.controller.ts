import { CallCenterActorGuard } from '../../customer-affairs/call-center-actor.guard';
import {
  Body,
  type CanActivate,
  Controller,
  type ExecutionContext,
  Get,
  Header,
  Inject,
  Injectable,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { AuthGuard } from '../../iam/auth.guard';
import { PermissionGuard } from '../../iam/permission.guard';
import { RequirePermissions } from '../../iam/iam.decorators';
import type { AuthenticatedRequest } from '../../iam/iam.types';
import { IssabelService } from './issabel.service';
import { IssabelRecordingsService } from './recordings.service';

export class OriginateDto {
  @IsUUID() id!: string;
  @IsUUID() connectionId!: string;
  @IsString() @Matches(/^\+?\d{7,15}$/) number!: string;
}
export class ActivateDto {
  @IsUUID() connectionId!: string;
  @IsInt() @Min(1) version!: number;
  @IsBoolean() active!: boolean;
}
export class RecordingStartDto {
  @IsUUID() id!: string;
  @IsString()
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9_.:-]+$/)
  rootCallId!: string;
  @IsString()
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9_.:-]+$/)
  externalCallId!: string;
  @IsIn(['IN', 'OUT']) direction!: 'IN' | 'OUT';
  @IsString() @Matches(/^[a-f0-9]{64}$/) sha256!: string;
  @IsInt() @Min(44) @Max(20971520) sizeBytes!: number;
}
export class RecordingChunkDto {
  @IsInt() @Min(0) @Max(639) index!: number;
  @IsString() @MaxLength(43692) data!: string;
}
@Controller('integrations/telephony/issabel')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermissions('customer_affairs.call_center.read')
export class IssabelController {
  constructor(
    @Inject(IssabelService) private readonly service: IssabelService,
  ) {}
  @Get('status') @Header('Cache-Control', 'private, no-store') status(
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.status(req.actor);
  }
  @Post('activation') activate(
    @Req() req: AuthenticatedRequest,
    @Body() input: ActivateDto,
  ) {
    return this.service.activate(
      req.actor,
      input.connectionId,
      input.version,
      input.active,
    );
  }
  @Post('commands') originate(
    @Req() req: AuthenticatedRequest,
    @Body() input: OriginateDto,
  ) {
    return this.service.originate(req.actor, input);
  }
  @Get('commands/:id') @Header('Cache-Control', 'private, no-store') command(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.command(req.actor, id);
  }
}

@Injectable()
export class IssabelRecordingGuard implements CanActivate {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext) {
    const secret =
      this.config.get<string>('ISSABEL_RECORDING_UPLOAD_SECRET') ?? '';
    const header = context.switchToHttp().getRequest<Request>()
      .headers.authorization;
    const supplied = header?.startsWith('Bearer ') ? header.slice(7) : '';
    if (
      this.config.get<string>('ISSABEL_ENABLED') !== 'true' ||
      secret.length < 32 ||
      [
        'TELEPHONY_WORKER_SECRET',
        'TELEPHONY_RELAY_SECRET',
        'ISSABEL_AMI_SECRET',
      ].some((key) => secret === this.config.get<string>(key)) ||
      Buffer.byteLength(secret) !== Buffer.byteLength(supplied) ||
      !timingSafeEqual(Buffer.from(secret), Buffer.from(supplied))
    )
      throw new UnauthorizedException();
    return true;
  }
}
/** Private PBX-to-ERP upload only: cannot originate calls or select a branch. */
@Controller('internal/issabel/recordings')
@UseGuards(IssabelRecordingGuard)
export class IssabelRecordingController {
  constructor(
    @Inject(IssabelRecordingsService)
    private readonly service: IssabelRecordingsService,
  ) {}
  @Post() start(@Body() input: RecordingStartDto) {
    return this.service.start(input);
  }
  @Post(':id/chunks') chunk(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: RecordingChunkDto,
  ) {
    return this.service.chunk(id, input.index, input.data);
  }
  @Post(':id/complete') finish(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.finish(id);
  }
}

@Controller('integrations/telephony/recordings')
@UseGuards(AuthGuard, CallCenterActorGuard, PermissionGuard)
@RequirePermissions(
  'customer_affairs.call_center.read',
  'customer_affairs.call_center.recordings.read',
)
export class TelephonyRecordingReadController {
  constructor(
    @Inject(IssabelRecordingsService)
    private readonly service: IssabelRecordingsService,
  ) {}
  @Get('calls/:callId')
  @Header('Cache-Control', 'private, no-store')
  forCall(
    @Req() req: AuthenticatedRequest,
    @Param('callId', ParseUUIDPipe) callId: string,
  ) {
    return this.service.forCall(req.actor, callId);
  }
  @Get('calls/:callId/:id/audio')
  async download(
    @Req() req: AuthenticatedRequest,
    @Param('callId', ParseUUIDPipe) callId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ) {
    const result = await this.service.read(req.actor, id, undefined, callId);
    response.set({
      'Cache-Control': 'private, no-store',
      'Content-Type': 'audio/wav',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `attachment; filename="recording-${id}.wav"`,
      'Content-Length': String(result.audio.length),
    });
    response.status(200).send(result.audio);
  }
  @Get(':id/audio')
  async audio(
    @Req() req: AuthenticatedRequest & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ) {
    const result = await this.service.read(req.actor, id, req.headers.range);
    response.set({
      'Cache-Control': 'private, no-store',
      'Content-Type': 'audio/wav',
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'bytes',
      'Content-Disposition': `inline; filename="recording-${id}.wav"`,
      'Content-Length': String(result.audio.length),
      ...(result.partial
        ? {
            'Content-Range': `bytes ${result.start}-${result.end}/${result.size}`,
          }
        : {}),
    });
    response.status(result.partial ? 206 : 200).send(result.audio);
  }
}
