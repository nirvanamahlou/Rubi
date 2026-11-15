import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import type { AuthenticatedRequest } from '../../iam/iam.types';
import { FinanceFiscalContextService } from './finance-fiscal-context.service';
import { FinanceFiscalStorage } from './finance-fiscal-storage';
import { fiscalYearIndependentRequest } from './accounting-fiscal-actions';

@Injectable()
export class FinanceFiscalInterceptor implements NestInterceptor {
  constructor(
    @Inject(FinanceFiscalContextService)
    private readonly fiscal: FinanceFiscalContextService,
    @Inject(FinanceFiscalStorage)
    private readonly storage: FinanceFiscalStorage,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}
  async intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const prefix =
      '/' +
      this.config.getOrThrow<string>('API_PREFIX').replace(/^\/+|\/+$/g, '');
    const path = request.path.startsWith(prefix + '/')
      ? request.path.slice(prefix.length)
      : request.path;
    const finance =
      path === '/finance' ||
      path.startsWith('/finance/') ||
      path === '/hr/payroll-finance' ||
      path.startsWith('/hr/payroll-finance/');
    if (!request.actor || !finance || path === '/finance/fiscal-context')
      return next.handle();
    const independent = fiscalYearIndependentRequest(
      path,
      request.method,
      typeof request.params.action === 'string'
        ? request.params.action
        : undefined,
    );
    // Shared account/reference pickers are also consumed outside Finance. Keep
    // their native authorization and avoid imposing a Finance calendar on them.
    if (
      independent &&
      !request.get('x-finance-company') &&
      !path.startsWith('/finance/accounting/')
    )
      return next.handle();
    const scope = await this.fiscal.resolve(request.actor, {
      company: request.get('x-finance-company'),
      actorId: request.get('x-finance-actor-id'),
      ...(!independent
        ? {
            periodId: request.get('x-finance-period-id'),
            version: request.get('x-finance-period-version'),
            mode: request.get('x-finance-period-mode'),
          }
        : {}),
    });
    return new Observable((subscriber) =>
      this.storage.run(scope, () => {
        if (!independent) {
          this.storage.require();
          // Accounting commands validate their explicit source/target periods under a book lock.
          // Other money operations must also guard legacy sources which predate event capture.
          if (
            !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
            !path.startsWith('/finance/accounting/')
          ) {
            const body =
              request.body && typeof request.body === 'object'
                ? (request.body as Record<string, unknown>)
                : {};
            const dates = ['transferAt', 'occurredAt', 'paidAt'].flatMap(
              (key) =>
                typeof body[key] === 'string' ? [body[key] as string] : [],
            );
            for (const date of dates.length ? dates : [new Date()])
              this.storage.assertDate(date, true);
          }
        }
        return next.handle().subscribe(subscriber);
      }),
    );
  }
}
