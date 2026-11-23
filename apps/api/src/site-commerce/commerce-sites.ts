export const commerceSites = {
  nss: {
    origin: 'https://niyayeshseir.ir',
    signingKey: 'NSS_CATALOG_WEBHOOK_SECRET',
    floatingTours: false,
  },
  'jahan-bastan': {
    origin: 'https://jahanbastan.ir',
    signingKey: 'JAHAN_BASTAN_CATALOG_WEBHOOK_SECRET',
    floatingTours: true,
  },
  ghestiroo: {
    origin: 'https://ghestiroo.ir',
    signingKey: 'GHESTIROO_CATALOG_WEBHOOK_SECRET',
    floatingTours: true,
  },
} as const;

export type CommerceSite = keyof typeof commerceSites;
export const deliverySites = Object.keys(commerceSites) as CommerceSite[];
export function isDeliverySite(site: string): site is CommerceSite {
  return Object.hasOwn(commerceSites, site);
}
