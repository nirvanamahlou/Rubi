import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import type { MasterDataRecord } from '@nora/contracts';
import {
  commerceSites,
  deliverySites,
  type CommerceSite,
} from './commerce-sites';
import { confirmDeletionSites } from './site-deletion';
import { commerceBindingSites } from './site-commerce.policy';

export function isWebsiteProfile(
  resource: string,
): resource is 'hotels' | 'cities' | 'countries' | 'visa-services' {
  return (
    resource === 'hotels' ||
    resource === 'cities' ||
    resource === 'countries' ||
    resource === 'visa-services'
  );
}

const destinationNames: Record<CommerceSite, string> = {
  nss: 'نیایش سیر',
  'jahan-bastan': 'جهان باستان',
  ghestiroo: 'قسطی‌رو',
};

async function checkSite(
  site: CommerceSite,
  secret: string,
  record: MasterDataRecord,
  action: 'inspect' | 'withdraw',
) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({
    site,
    action,
    kind: record.resource,
    id: record.id,
    name: record.name,
    countryName:
      record.resource === 'cities' ? record.attributes.countryName : undefined,
    identificationCode:
      record.resource === 'hotels'
        ? record.attributes.identificationCode
        : undefined,
  });
  const signature = createHmac('sha256', secret)
    .update(timestamp + '.' + body)
    .digest('hex');
  const result = await fetch(
    commerceSites[site].origin + '/api/v1/erp/profile-withdrawal',
    {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(8_000),
      headers: {
        'content-type': 'application/json',
        'x-erp-timestamp': timestamp,
        'x-erp-signature': signature,
      },
      body,
    },
  ).catch(() => null);
  if (result?.status === 409)
    throw new ConflictException(
      `تطبیق پروفایل یا وابستگی‌های انتشار در سایت ${destinationNames[site]} را بررسی کنید.`,
    );
  const receipt = result?.ok
    ? ((await result.json().catch(() => null)) as {
        linked?: unknown;
        blocked?: unknown;
      } | null)
    : null;
  if (
    typeof receipt?.linked !== 'boolean' ||
    typeof receipt.blocked !== 'boolean'
  )
    throw new ServiceUnavailableException(
      `سایت ${destinationNames[site]} وضعیت انتشار را تأیید نکرد.`,
    );
  return { siteCode: site, linked: receipt.linked, blocked: receipt.blocked };
}

export async function withdrawProfileFromSite(
  site: CommerceSite,
  record: MasterDataRecord,
) {
  const secret = process.env[commerceSites[site].signingKey];
  if (!secret || secret.length < 32)
    throw new ServiceUnavailableException('اتصال سایت پیکربندی نشده است.');
  const result = await checkSite(site, secret, record, 'withdraw');
  if (result.blocked)
    throw new ConflictException(
      `محتوای منتشرشده در سایت ${destinationNames[site]} به این رکورد وابسته است.`,
    );
  return result;
}

async function destinations(record: MasterDataRecord) {
  const bound = new Set(commerceBindingSites());
  const sites = deliverySites.flatMap((site) => {
    const secret = process.env[commerceSites[site].signingKey];
    if (secret && secret.length >= 32) return [{ site, secret }];
    if (bound.has(site) || secret)
      throw new ServiceUnavailableException('اتصال سایت پیکربندی نشده است.');
    return [];
  });
  const checks = await Promise.all(
    sites.map(({ site, secret }) => checkSite(site, secret, record, 'inspect')),
  );
  return { sites, checks };
}

export async function profileDeletionSites(record: MasterDataRecord) {
  const { checks } = await destinations(record);
  return checks.filter(({ linked }) => linked).map(({ siteCode }) => siteCode);
}

export async function withdrawWebsiteProfile(
  record: MasterDataRecord,
  siteCodes: unknown,
) {
  const { sites, checks } = await destinations(record);
  const selected = confirmDeletionSites(
    checks.filter(({ linked }) => linked),
    siteCodes,
  );
  const blocked = checks.find(({ blocked }) => blocked);
  if (blocked)
    throw new ConflictException(
      `محتوای منتشرشده در سایت ${destinationNames[blocked.siteCode]} به این رکورد وابسته است.`,
    );
  const results = await Promise.allSettled(
    sites
      .filter(({ site }) => selected.includes(site))
      .map(({ site, secret }) => checkSite(site, secret, record, 'withdraw')),
  );
  for (const result of results)
    if (result.status === 'rejected') throw result.reason;
}
