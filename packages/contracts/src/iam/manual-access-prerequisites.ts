import type { ManualAccessSelection } from './manual-access';

/** Complete only view prerequisites; the server still checks every added grant. */
export function completeManualAccessPrerequisites(
  selection: ManualAccessSelection,
  previous?: Pick<ManualAccessSelection, 'screenIds' | 'permissionCodes'>,
): ManualAccessSelection {
  const screens = new Set(selection.screenIds);
  if (
    selection.permissionCodes.includes('floating_purchases.write.own') ||
    selection.permissionCodes.includes('floating_purchases.read.all')
  ) {
    screens.add('floating-purchases.hotels');
    screens.add('floating-purchases.flights');
  }
  const permissions = new Set(selection.permissionCodes);
  if (screens.has('customer-affairs.call-center')) {
    permissions.add('customer_affairs.call_center.read');
    // Newly selecting the panel gives a usable own-data view, never team access.
    // Do not alter the scope of existing legacy users or restore explicitly removed scopes.
    if (!previous?.screenIds.includes('customer-affairs.call-center')) {
      for (const purpose of ['contacts', 'reports']) {
        if (
          !permissions.has(
            `customer_affairs.call_center.${purpose}.read.own`,
          ) &&
          !permissions.has(`customer_affairs.call_center.${purpose}.read.team`)
        )
          permissions.add(`customer_affairs.call_center.${purpose}.read.own`);
      }
    }
  }
  const integrationChildren = selection.screenIds.filter(
    (id) =>
      id.startsWith('integrations.section.') ||
      id === 'system.module.integrations',
  );
  if (integrationChildren.length) screens.add('integrations.home');
  if (
    screens.has('integrations.home') &&
    !integrationChildren.length &&
    !previous?.screenIds.includes('integrations.home')
  )
    screens.add('integrations.section.brands');
  return {
    screenIds: [...screens],
    permissionCodes: [...permissions],
    allowedControlIds: [
      ...new Set([
        ...selection.allowedControlIds,
        ...[...screens].filter(
          (id) =>
            id.startsWith('floating-purchases.') &&
            (permissions.has('floating_purchases.write.own') ||
              permissions.has('floating_purchases.read.all')),
        ),
      ]),
    ],
  };
}
