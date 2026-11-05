import type { IllustrationKind } from '../ui/illustration-icon';

export const isCallCenterAppearance = (pathname: string) =>
  pathname === '/customer-affairs/call-center' ||
  pathname.startsWith('/customer-affairs/call-center/');

export const callCenterGroupIllustrations: Record<string, IllustrationKind> = {
  work: 'home',
  sales: 'people',
  operations: 'calendar',
  'ticket-purchases': 'cart',
  finance: 'coins',
  hr: 'people',
  resources: 'folder',
  correspondence: 'mail',
  system: 'settings',
};

export function callCenterNavigationIllustration(
  href: string,
): IllustrationKind {
  if (href.includes('call-center')) return 'headset';
  if (href.includes('workbench')) return 'home';
  if (href.includes('dashboard') || href.includes('reports')) return 'chart';
  if (href.includes('finance') || href.includes('pricing')) return 'coins';
  if (href.includes('reservations') || href.includes('ticket'))
    return 'calendar';
  if (href.includes('correspondence')) return 'mail';
  if (href.includes('customers') || href.includes('resources')) return 'people';
  if (
    href.includes('system') ||
    href.includes('integrations') ||
    href.includes('master-data')
  )
    return 'settings';
  if (href.includes('organizations')) return 'building';
  if (href.includes('purchases')) return 'cart';
  return 'folder';
}
