import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';

import { DocumentsWorkspace } from '@/modules/documents/components/documents-workspace';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'اسناد و فایل‌ها' });
}

// Dedicated replacement for ModuleFoundationWorkspace / foundationModules['documents'].

export default function Page() {
  return <DocumentsWorkspace />;
}
