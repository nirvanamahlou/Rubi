import {
  BadRequestException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class SiteCommerceWriteGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD'].includes(request.method)) return true;
    if (
      request.headers['x-nora-site-commerce'] !== '1' ||
      !request.is('application/json')
    )
      throw new BadRequestException('درخواست اتصال سایت معتبر نیست.');
    return true;
  }
}
