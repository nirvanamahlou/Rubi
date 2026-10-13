import type { Metadata } from 'next';
import { localizedMetadata } from '@/i18n/metadata';
import { UserManagement } from '../../users/user-management';
export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'مدیریت کاربران' });
}
export default function Page() {
  return <UserManagement />;
}
