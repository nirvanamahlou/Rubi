import { ForbiddenException } from '@nestjs/common';
import {
  MANUAL_ACCESS_VERSION,
  canViewScreen,
  type AuthenticatedActor,
} from '@nora/contracts';

/** Screen-specific API surfaces. Shared lookup APIs keep their native domain guards. */
export function assertManualApiAccess(
  actor: AuthenticatedActor,
  requestPath: string,
  method = 'GET',
) {
  if (!actor.permissions.includes(MANUAL_ACCESS_VERSION)) return;
  const path = requestPath
    .split('?')[0]!
    .replace(/^\/api(?:\/v\d+)?(?=\/)/, '');
  const rules: Array<[RegExp, string[]]> = [
    [/^\/procurement\/ticket-purchases(?:\/|$)/, ['ticket-purchases.home']],
    [/^\/iam\/(?:users|access-options)(?:\/|$)/, ['system.users']],
    [/^\/workbench\/(?:notes|note-folders)(?:\/|$)/, ['workbench.tab.notes']],
    [/^\/workbench\/calendar(?:\/|$)/, ['workbench.tab.calendar']],
    [/^\/workbench\/performance(?:\/|$)/, ['workbench.tab.performance']],
    [/^\/workbench\/activity(?:\/|$)/, ['workbench.tab.activity']],
    [
      /^\/workbench\/procurement-follow-ups(?:\/|$)/,
      ['workbench.tab.requests'],
    ],
    [/^\/messaging(?:\/|$)/, ['workbench.tab.messages']],
    [/^\/customers\/[^/]+\/contacts(?:\/|$)/, ['customers.tab.contacts']],
    [/^\/customers\/[^/]+\/addresses(?:\/|$)/, ['customers.tab.addresses']],
    [/^\/customers\/[^/]+\/consents(?:\/|$)/, ['customers.tab.consents']],
    [/^\/customers\/[^/]+\/companions(?:\/|$)/, ['customers.tab.companions']],
    [
      /^\/customers\/[^/]+\/status-history(?:\/|$)/,
      ['customers.tab.status-history'],
    ],
    [/^\/customers\/[^/]+\/activity(?:\/|$)/, ['customers.tab.activity']],
    [/^\/customers\/[^/]+\/audit(?:\/|$)/, ['customers.tab.audit']],
  ];
  const rule = rules.find(([pattern]) => pattern.test(path));
  if (rule && !rule[1].some((id) => canViewScreen(actor.permissions, id)))
    throw new ForbiddenException({
      error: 'SCREEN_ACCESS_RESTRICTED',
      screenIds: rule[1],
    });
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) &&
    /^\/ticket-catalog\/(?:sale-price-targets(?:\/|$)|offers\/sale-commissions(?:\/|$)|offers\/[^/]+\/(?:round-trip-sale-price|standalone-sale-price)(?:\/|$))/.test(
      path,
    ) &&
    !canViewScreen(actor.permissions, 'sales.ticket-prices')
  )
    throw new ForbiddenException({
      error: 'SCREEN_ACCESS_RESTRICTED',
      screenIds: ['sales.ticket-prices'],
    });
}
