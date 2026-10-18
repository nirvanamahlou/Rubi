import { createHash } from 'node:crypto';
import { MANUAL_ACCESS_ROLE_PREFIX } from '@nora/contracts';

export const ROLE_TEMPLATE_PREFIX = 'personal-access-template-job-';
export const reusableRoleWhere = {
  OR: [
    { code: { startsWith: ROLE_TEMPLATE_PREFIX } },
    {
      NOT: [
        { code: { startsWith: 'personal-access-' } },
        { code: { startsWith: MANUAL_ACCESS_ROLE_PREFIX } },
      ],
    },
  ],
};
export function isPrivateUserRole(code: string) {
  return (
    code.startsWith(MANUAL_ACCESS_ROLE_PREFIX) ||
    (code.startsWith('personal-access-') &&
      !code.startsWith(ROLE_TEMPLATE_PREFIX))
  );
}
export function roleDirectoryRevision(role: {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  isSystem: boolean;
  updatedAt: Date;
  users: Array<{ userId: string }>;
  permissions: Array<{ permissionId: string }>;
}) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        id: role.id,
        code: role.code,
        name: role.name,
        active: role.isActive,
        system: role.isSystem,
        updatedAt: role.updatedAt.toISOString(),
        users: role.users.map((u) => u.userId).sort(),
        permissions: role.permissions.map((p) => p.permissionId).sort(),
      }),
    )
    .digest('hex');
}
