interface SelectedUserSave {
  userId: string;
  branchIds: string[];
  originalBranchIds: string[];
  saveManualAccess?: (() => Promise<boolean>) | undefined;
  request: (path: string, init?: RequestInit) => Promise<unknown>;
}

/** Role and branch endpoints retain their independent server-side revision checks. */
export async function saveSelectedUserChanges(input: SelectedUserSave) {
  if (!input.saveManualAccess || !(await input.saveManualAccess()))
    return false;
  if (
    JSON.stringify([...input.branchIds].sort()) ===
    JSON.stringify([...input.originalBranchIds].sort())
  )
    return true;
  const users = (await input.request('/iam/users')) as {
    id: string;
    accessRevision: string;
  }[];
  const current = users.find((user) => user.id === input.userId);
  if (!current) throw new Error('کاربر پیدا نشد.');
  await input.request(`/iam/users/${input.userId}/access`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accessRevision: current.accessRevision,
      branchIds: input.branchIds,
    }),
  });
  return true;
}
