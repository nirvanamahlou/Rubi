import type { Metadata } from 'next';

import { DocumentsWorkspace } from '@/modules/documents/components/documents-workspace';

export const metadata: Metadata = { title: 'اسناد و فایل‌ها' };

// Dedicated replacement for ModuleFoundationWorkspace / foundationModules['documents'].

export default function Page() {
  return <DocumentsWorkspace />;
}
