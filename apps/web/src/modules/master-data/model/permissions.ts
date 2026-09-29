export const masterDataPermissions = [
  'master_data.read',
  'master_data.create',
  'master_data.update',
  'master_data.status.manage',
  'master_data.export',
  'master_data.import',
  'master_data.audit.read',
  'master_data.currency_rate.create',
  'master_data.currency_rate.approve',
  'master_data.sensitive_contact.read',
  'master_data.sensitive_contact.unmask',
  'master_data.delete',
] as const;

export type MasterDataPermission = (typeof masterDataPermissions)[number];
export type ProposedMasterDataRole =
  'viewer' | 'editor' | 'manager' | 'exporter';

export const proposedPermissionMatrix: Readonly<
  Record<ProposedMasterDataRole, readonly MasterDataPermission[]>
> = {
  viewer: ['master_data.read'],
  editor: ['master_data.read', 'master_data.create', 'master_data.update'],
  manager: [...masterDataPermissions],
  exporter: ['master_data.read', 'master_data.export'],
};

export function hasProposedPermission(
  role: ProposedMasterDataRole,
  permission: MasterDataPermission,
) {
  return proposedPermissionMatrix[role].includes(permission);
}
