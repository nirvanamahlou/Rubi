import type { Metadata } from 'next';

import {
  Alert,
  EmptyState,
  PageHeader,
  Skeleton,
} from '@/components/ui/surfaces';
import { faMessages } from '@/messages/fa';

export const metadata: Metadata = { title: 'منابع انسانی' };

export default function HumanResourcesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        description="زیرساخت صفحه منابع انسانی؛ قابلیت‌های تخصصی در Work Item مستقل PC-B توسعه می‌یابند."
        eyebrow={faMessages.placeholder.eyebrow}
        title="منابع انسانی"
      />
      <Alert
        description="در این Foundation هیچ فرم پرسنلی، قرارداد، مرخصی، حضور و غیاب یا حقوق ایجاد نشده است."
        title={faMessages.placeholder.title}
      />
      <section
        aria-label="نمونه وضعیت بارگذاری"
        className="grid gap-3 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-3"
      >
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </section>
      <EmptyState
        description={faMessages.placeholder.emptyDescription}
        title={faMessages.placeholder.emptyTitle}
      />
    </div>
  );
}
