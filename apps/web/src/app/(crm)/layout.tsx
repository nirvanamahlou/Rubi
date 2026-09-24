import type { ReactNode } from 'react';

import { AppShell } from '@/components/layout/app-shell';
import { SystemPreferencesProvider } from '@/components/system-preferences-provider';

export default function CrmLayout({ children }: { children: ReactNode }) {
  return (
    <SystemPreferencesProvider>
      <AppShell>{children}</AppShell>
    </SystemPreferencesProvider>
  );
}
