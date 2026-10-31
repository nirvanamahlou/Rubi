import {
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { IamCallCenterDirectory } from '../iam/iam-call-center-directory';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { answeredCallAccess } from '../iam/call-center-answer-policy';

/** Request-local Call Center scope only; never persists or changes the authenticated session. */
@Injectable()
export class CallCenterActorGuard implements CanActivate {
  constructor(
    @Optional()
    @Inject(IamCallCenterDirectory)
    private readonly directory?: IamCallCenterDirectory,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!answeredCallAccess()) return true;
    if (!this.directory) throw new ForbiddenException();
    request.actor = await this.directory.callCenterActor(request.actor);
    return true;
  }
}
