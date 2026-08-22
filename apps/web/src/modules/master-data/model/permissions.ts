export const masterDataPermissions = [
  'master_data.read',
  'master_data.create',
  'master_data.update',
  'master_data.status.manage',
  'master_data.export',
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
