import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';

import { UserManagement } from './user-management';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'مدیریت کاربران' });
}

export default function Page() {
  return <UserManagement />;
}
