import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import {
  ACCESS_COOKIE,
  ACCESS_TTL_SECONDS,
  REFRESH_COOKIE,
} from './iam.constants';
import { Public } from './iam.decorators';
import { LoginDto } from './dto/login.dto';
import { AuthGuard, readCookie } from './auth.guard';
import { IamService } from './iam.service';
import type { AuthenticatedRequest, RequestMetadata } from './iam.types';

@ApiTags('IAM / Authentication')
@Controller('iam/auth')
export class AuthController {
  constructor(@Inject(IamService) private readonly iam: IamService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiBody({ type: LoginDto })
  @ApiOperation({ summary: 'Secure staff login' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.iam.login(
      dto.username,
      dto.password,
      requestMetadata(request),
    );
    this.setCookies(
      response,
      result.accessToken,
      result.refreshToken,
      result.expiresAt,
    );
    return result.body;
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.iam.refresh(
      readCookie(request, REFRESH_COOKIE),
      requestMetadata(request),
    );
    this.setCookies(
      response,
      result.accessToken,
      result.refreshToken,
      result.expiresAt,
    );
    return result.body;
  }

  @UseGuards(AuthGuard)
  @ApiCookieAuth(ACCESS_COOKIE)
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.iam.logout(
      request.actor.sessionId,
      request.actor.userId,
      requestMetadata(request),
    );
    response.clearCookie(ACCESS_COOKIE, cookieBase());
    response.clearCookie(REFRESH_COOKIE, cookieBase());
  }

  @UseGuards(AuthGuard)
  @Get('sessions')
  sessions(@Req() request: AuthenticatedRequest) {
    return this.iam.listSessions(request.actor);
  }

  @UseGuards(AuthGuard)
  @Delete('sessions/:id')
  @HttpCode(204)
  async revokeSession(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.iam.revokeSession(id, request.actor, requestMetadata(request));
  }

  private setCookies(
    response: Response,
    access: string,
    refresh: string,
    refreshExpires: Date,
  ): void {
    response.cookie(ACCESS_COOKIE, access, {
      ...cookieBase(),
      maxAge: ACCESS_TTL_SECONDS * 1000,
    });
    response.cookie(REFRESH_COOKIE, refresh, {
      ...cookieBase(),
      expires: refreshExpires,
    });
  }
}

function cookieBase() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
}
function requestMetadata(request: Request): RequestMetadata {
  const ipAddress = request.ip?.slice(0, 64);
  const userAgent = request.get('user-agent')?.slice(0, 500);
  return {
    ...(ipAddress ? { ipAddress } : {}),
    ...(userAgent ? { userAgent } : {}),
  };
}
export { requestMetadata };
