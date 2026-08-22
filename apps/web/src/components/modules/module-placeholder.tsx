import { Alert, EmptyState, PageHeader } from '@/components/ui/surfaces';
import { getNavigationItem } from '@/lib/navigation';
import { faMessages, type NavigationHref } from '@/messages/fa';

export function ModulePlaceholder({ href }: { href: NavigationHref }) {
  const item = getNavigationItem(href);
  if (!item) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        description={item.description}
        eyebrow={faMessages.placeholder.eyebrow}
        title={item.title}
      />
      <Alert
        description={faMessages.placeholder.description}
        title={faMessages.placeholder.title}
      />
      <EmptyState
        description={faMessages.placeholder.emptyDescription}
        title={faMessages.placeholder.emptyTitle}
      />
    </div>
  );
}
