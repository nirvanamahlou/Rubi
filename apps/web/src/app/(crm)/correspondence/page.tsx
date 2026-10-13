import { localizedMetadata } from '@/i18n/metadata';
import { CorrespondenceWorkspace } from '@/modules/correspondence/correspondence-workspace';
export async function generateMetadata() {
  return localizedMetadata({ title: 'مکاتبات' });
}
export default function Page() {
  return <CorrespondenceWorkspace />;
}
