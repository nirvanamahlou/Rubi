import {
  Injectable,
  Inject,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import type { Request } from 'express';
import { concatMap, from, type Observable } from 'rxjs';
import { IamService } from '../iam/iam.service';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { TravelWorkflowService } from './travel-workflow.service';

/** Native revisions preserve original commit time (including replay); audit covers passenger/file changes and future mutations. */
@Injectable()
export class ReservationOperationInterceptor implements NestInterceptor {
  constructor(
    @Inject(TravelWorkflowService)
    private readonly workflow: TravelWorkflowService,
    @Inject(IamService) private readonly iam: IamService,
  ) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<Request & AuthenticatedRequest>();
    const id = req.params.intakeId ?? req.params.id;
    const route = String(req.route?.path ?? '');
    if (
      !['POST', 'PATCH', 'DELETE', 'PUT'].includes(req.method) ||
      typeof id !== 'string' ||
      /delivery|payment/.test(route) ||
      [
        'record',
        'recordServicePurchase',
        'updateArrangement',
        'workflowUpdate',
      ].includes(context.getHandler().name)
    )
      return next.handle();
    return from(this.workflow.detail(id, req.actor.branchIds)).pipe(
      concatMap((intake) =>
        next.handle().pipe(
          concatMap(async (value: unknown) => {
            await this.iam.recordReservationOperation(
              id,
              intake.branchId,
              req.actor,
              `reservations.${context.getHandler().name}`,
            );
            return value;
          }),
        ),
      ),
    );
  }
}
