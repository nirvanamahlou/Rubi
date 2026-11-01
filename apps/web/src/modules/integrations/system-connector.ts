import type {
  IntegrationRegistryV1,
  IntegrationSystemConfigV1,
} from '@nora/contracts';

/** Route by registered identity or exact site host, never a translated display name. */
export function isGhestirooSystem(
  system: IntegrationSystemConfigV1,
  registry: Pick<IntegrationRegistryV1, 'brands'>,
) {
  const brand = registry.brands.find((row) => row.id === system.brandId);
  if (brand?.code === 'ghesti-roo' || system.code === 'ghesti-roo-primary')
    return true;
  if (!system.setup?.websiteUrl) return false;
  try {
    return ['ghestiroo.ir', 'www.ghestiroo.ir'].includes(
      new URL(system.setup.websiteUrl).hostname,
    );
  } catch {
    return false;
  }
}
