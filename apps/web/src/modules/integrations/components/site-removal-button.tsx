import { Trash2 } from 'lucide-react';

export function SiteRemovalButton({
  siteName,
  disabled,
  onRemove,
}: {
  siteName: string;
  disabled: boolean;
  onRemove: () => void;
}) {
  const label = `حذف از ${siteName}`;
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onRemove}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-red-500/30 text-red-600 hover:bg-red-500/10 focus-visible:outline-2 focus-visible:outline-red-500 disabled:opacity-40 dark:text-red-400"
    >
      <Trash2 aria-hidden="true" className="size-4" />
    </button>
  );
}
