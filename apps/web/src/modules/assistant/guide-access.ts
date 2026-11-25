import { canViewRoute, canViewScreen } from '@nora/contracts';

/** Matches the panel scope for links, including reports with permissions from multiple owners. */
export function canOpenAssistantGuide(
  permissions: readonly string[],
  href: string,
  required?: string,
) {
  if (
    !canViewRoute(permissions, href) ||
    (required && !permissions.includes(required))
  )
    return false;
  const [path, search = ''] = href.split('#')[0]!.split('?');
  if (path?.toLowerCase() !== '/reservations') return true;
  for (const [key, value] of new URLSearchParams(search)) {
    if (
      key.toLowerCase() === 'report' &&
      value.toLowerCase() === 'settled-vouchers'
    ) {
      return (
        [
          'finance.read',
          'finance.financial_release.read',
          'reservations.read',
        ].every((code) => permissions.includes(code)) &&
        canViewScreen(permissions, 'finance.delivery') &&
        canViewScreen(permissions, 'reservations.home')
      );
    }
  }
  return true;
}
