import { localizedMetadata } from '@/i18n/metadata';
import { CallCenterWorkspace } from '@/modules/call-center/workspace';

export async function generateMetadata() {
  return localizedMetadata({ title: 'کال سنتر' });
}

export default function Page() {
  return <CallCenterWorkspace />;
}
