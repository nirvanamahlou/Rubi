import { Alert, EmptyState, PageHeader } from '@/components/ui/surfaces';
import { getNavigationItem } from '@/lib/navigation';
import { faMessages, type NavigationHref } from '@/messages/fa';

type LegacyNavigationHref = '/settings' | '/users';

export function ModulePlaceholder({
  href,
}: {
  href: NavigationHref | LegacyNavigationHref;
}) {
  const navigationHref =
    href === '/settings' || href === '/users' ? '/system' : href;
  const item = getNavigationItem(navigationHref);
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
