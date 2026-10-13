import { Inject, Injectable } from '@nestjs/common';
import type { SystemScope } from '@nora/contracts';

import { DatabaseService } from '../database/database.service';

export interface SettingsRuntimeContext {
  userId?: string;
  branchId?: string;
  legalEntityId?: string;
}

export interface ResolvedSystemSetting<T> {
  value: T;
  version: number;
  scope: SystemScope;
  scopeId: string | null;
}

/**
 * Read-only runtime port for module owners.
 *
 * System Management owns writes and audit; consumers only resolve the active
 * value through this port. Scope precedence is deliberately centralized so a
 * module cannot accidentally implement a different inheritance order.
 */
@Injectable()
export class SettingsRuntimeService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async resolve<T = unknown>(
    namespace: string,
    key: string,
    context: SettingsRuntimeContext = {},
  ): Promise<ResolvedSystemSetting<T> | null> {
    const orderedScopeKeys = [
      context.userId ? `USER:${context.userId}` : null,
      context.branchId ? `BRANCH:${context.branchId}` : null,
      context.legalEntityId ? `LEGAL_ENTITY:${context.legalEntityId}` : null,
      'GLOBAL',
    ].filter((scopeKey): scopeKey is string => Boolean(scopeKey));

    const rows = await this.database.client.systemSetting.findMany({
      where: {
        namespace,
        key,
        scopeKey: { in: orderedScopeKeys },
        status: 'ACTIVE',
      },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    const selected = [...rows].sort(
      (left, right) =>
        orderedScopeKeys.indexOf(left.scopeKey) -
        orderedScopeKeys.indexOf(right.scopeKey),
    )[0];
    const version = selected?.versions[0];
    if (!selected || !version) return null;

    return {
      value: version.value as T,
      version: selected.activeVersion,
      scope: selected.scope as SystemScope,
      scopeId: selected.scopeId,
    };
  }

  async json<T extends object>(
    namespace: string,
    key: string,
    context: SettingsRuntimeContext,
    fallback: T,
  ): Promise<ResolvedSystemSetting<T>> {
    const resolved = await this.resolve<T>(namespace, key, context);
    return (
      resolved ?? {
        value: fallback,
        version: 0,
        scope: 'GLOBAL',
        scopeId: null,
      }
    );
  }
}
