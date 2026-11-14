import { createHash } from 'node:crypto';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type {
  AuthenticatedActor,
  SalesContractCreateRequest,
} from '@nora/contracts';

export function stableFingerprint(value: unknown): string {
  function canonical(input: unknown): unknown {
    if (Array.isArray(input)) return input.map(canonical);
    if (input && typeof input === 'object')
      return Object.fromEntries(
        Object.entries(input)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, canonical(v)]),
      );
    return input;
  }
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

export function siteBinding(
  site: string,
  actor: AuthenticatedActor,
  raw = process.env.SITE_COMMERCE_BINDINGS ?? '{}',
) {
  let bindings: Record<string, { userId: string; branchId: string }>;
  try {
    bindings = JSON.parse(raw);
  } catch {
    throw new ForbiddenException('اتصال سایت تنظیم نشده است.');
  }
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings))
    throw new ForbiddenException('اتصال سایت تنظیم نشده است.');
  const binding = Object.hasOwn(bindings, site) ? bindings[site] : undefined;
  if (
    !binding ||
    binding.userId !== actor.userId ||
    !actor.branchIds.includes(binding.branchId)
  )
    throw new ForbiddenException('اتصال سایت مجاز نیست.');
  return binding;
}

export function externalOrderId(value: string) {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/.test(value)
  )
    throw new BadRequestException('شناسه سفارش سایت معتبر نیست.');
  return value;
}

/** No arbitrary legacy/manual services, discount, owner override or payment in a draft. */
export function assertWebsiteDraft(input: SalesContractCreateRequest) {
  if (
    !input ||
    !Array.isArray(input.services) ||
    !input.services.length ||
    input.assignedUserId ||
    input.payments?.length ||
    input.services.some(
      (s) =>
        (!['FLIGHT', 'HOTEL', 'TOUR', 'TRANSFER', 'INSURANCE', 'VISA'].includes(
          s.kind,
        ) &&
          !(
            s.kind === 'OTHER' &&
            ['CITY_TOUR', 'TOUR_GUIDE'].includes(
              String(s.metadata?.additionalServiceRole),
            )
          )) ||
        s.metadata?.legacyContractV1 ||
        s.metadata?.legacyServicePartiesV2,
    ) ||
    !Array.isArray(input.priceComponents) ||
    input.priceComponents.some((p) => p.type !== 'BASE')
  )
    throw new BadRequestException('درخواست قرارداد سایت معتبر نیست.');
}
