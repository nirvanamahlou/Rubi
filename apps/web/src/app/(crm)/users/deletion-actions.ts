export type IamRequest = (path: string, init?: RequestInit) => Promise<unknown>;
export async function deleteUserAndReload<T extends { id: string }>(
  id: string,
  request: IamRequest,
): Promise<T[]> {
  const snapshot = (await request(`/iam/users/${id}/manual-access`)) as {
    revision?: string;
  };
  if (!snapshot || typeof snapshot.revision !== 'string')
    throw Error('دریافت نسخهٔ دسترسی کاربر انجام نشد.');
  const result = (await request(`/iam/users/${id}`, {
    method: 'DELETE',
    headers: { 'If-Match': snapshot.revision },
  })) as { success?: boolean };
  if (result?.success !== true) throw Error('حذف کاربر در سرور تأیید نشد.');
  const users = (await request('/iam/users')) as T[];
  if (!Array.isArray(users) || users.some((row) => row.id === id))
    throw Error('کاربر هنوز در فهرست سرور وجود دارد؛ فهرست را تازه‌سازی کنید.');
  return users;
}
export async function deleteRoleAndReload<T extends { id: string }>(
  id: string,
  revision: string,
  request: IamRequest,
): Promise<T[]> {
  const result = (await request(`/iam/access-options/roles/${id}`, {
    method: 'DELETE',
    headers: { 'If-Match': revision },
  })) as { success?: boolean };
  if (result?.success !== true) throw Error('حذف نقش در سرور تأیید نشد.');
  const rows = (await request('/iam/access-options/roles')) as T[];
  if (!Array.isArray(rows) || rows.some((row) => row.id === id))
    throw Error('نقش هنوز در فهرست سرور وجود دارد؛ فهرست را تازه‌سازی کنید.');
  return rows;
}
