import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { ACCESS_COOKIE, IS_PUBLIC_KEY } from './iam.constants';
import { IamService } from './iam.service';
import type { AuthenticatedRequest } from './iam.types';

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  return header
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(IamService) private readonly iam: IamService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readCookie(request, ACCESS_COOKIE);
    if (!token) throw new UnauthorizedException('دسترسی معتبر نیست.');
    request.actor = await this.iam.authenticate(decodeURIComponent(token));
    return true;
  }
}

export { readCookie };
