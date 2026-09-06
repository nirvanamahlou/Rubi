import type { Metadata } from 'next';
import Link from 'next/link';
import { ModuleFoundationWorkspace } from '@/modules/module-foundation/components/module-foundation-workspace';
import { foundationModules } from '@/modules/module-foundation/model/foundation';
export const metadata: Metadata = { title: 'منابع انسانی' };
export default function Page() {
  return (
    <div className="space-y-5">
      <Link
        href="/hr"
        className="block rounded-2xl bg-blue-700 p-5 font-bold text-white focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        ورود به فضای منابع انسانی — پیش‌نمایش بنیاد ماژول
      </Link>
      <ModuleFoundationWorkspace
        config={foundationModules['human-resources']}
      />
    </div>
  );
}
