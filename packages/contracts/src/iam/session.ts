import type { BranchReference, IamPermissionCode } from './index';

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isBranch(value: unknown): value is BranchReference {
  const branch = object(value);
  return (
    !!branch &&
    typeof branch.id === 'string' &&
    typeof branch.code === 'string' &&
    typeof branch.name === 'string'
  );
}

function isRole(value: unknown): value is { code: string; name: string } {
  const role = object(value);
  return (
    !!role && typeof role.code === 'string' && typeof role.name === 'string'
  );
}

/** V1 is the existing login/refresh payload. Optional roles support older producers. */
export function readIamSessionV1(value: unknown) {
  const user = object(object(value)?.user);
  if (!user) return null;

  const { id, username, email, displayName, permissions, branches, roles } =
    user;
  if (
    typeof id !== 'string' ||
    !id.trim() ||
    typeof username !== 'string' ||
    (email !== null && typeof email !== 'string') ||
    typeof displayName !== 'string' ||
    !Array.isArray(permissions) ||
    !permissions.every(
      (permission: unknown) => typeof permission === 'string',
    ) ||
    !Array.isArray(branches) ||
    !branches.every(isBranch) ||
    (roles !== undefined && (!Array.isArray(roles) || !roles.every(isRole)))
  )
    return null;

  return {
    user: {
      id,
      username,
      email,
      displayName,
      // Permission names are open on the wire for mixed-version clients. The
      // consumer only matches its known codes; the server enforces all grants.
      permissions: permissions as IamPermissionCode[],
      branches,
      ...(roles === undefined ? {} : { roles }),
    },
  };
}

export type LoginResponse = NonNullable<ReturnType<typeof readIamSessionV1>>;
