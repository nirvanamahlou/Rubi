import type { Metadata } from 'next';

import { UserManagement } from './user-management';

export const metadata: Metadata = { title: 'مدیریت کاربران' };

export default function Page() {
  return <UserManagement />;
}
