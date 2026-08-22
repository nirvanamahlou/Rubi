import { Ban, DatabaseZap, Eye, FilePenLine, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Alert,
  Badge,
  DataTableShell,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@/components/ui/surfaces';
import type { MasterDataCatalogItem } from '../model/catalog';

import {
  MASTER_DATA_PREVIEW_DISCLOSURE,
  type MasterDataPreviewState,
} from './component-contract';
export type { MasterDataPreviewState } from './component-contract';

interface MasterDataStatePanelProps {
  definition: MasterDataCatalogItem;
  state: MasterDataPreviewState;
  onCreate?: () => void;
  onEdit?: () => void;
  onRetry?: () => void;
  onView?: () => void;
}

export function MasterDataStatePanel({
  definition,
  onCreate,
  onEdit,
  onRetry,
  onView,
  state,
}: MasterDataStatePanelProps) {
  if (state === 'loading') {
    return (
      <div
        aria-label="در حال بارگذاری"
        aria-live="polite"
        className="space-y-3"
      >
        {[0, 1, 2].map((item) => (
          <Skeleton className="h-16 w-full" key={item} />
        ))}
      </div>
    );
  }

  if (state === 'error') {
    return (
      <ErrorState
        action={
          <Button onClick={onRetry} size="sm" variant="outline">
            <RefreshCw aria-hidden="true" className="size-4" />
            تلاش دوباره
          </Button>
        }
        description="خطای استاندارد API در این بخش نمایش داده می‌شود؛ جزئیات خام یا داده حساس نمایش داده نخواهد شد."
        title="دریافت اطلاعات پایه ناموفق بود"
      />
    );
  }

  if (state === 'forbidden') {
    return (
      <EmptyState
        description="این حالت deny-by-default است و تا دریافت master_data.read از IAM هیچ رکوردی نمایش نمی‌دهد."
        icon={Ban}
        title="دسترسی مشاهده اطلاعات پایه وجود ندارد"
      />
    );
  }

  if (state === 'empty') {
    return (
      <EmptyState
        action={
          <Button onClick={onCreate} size="sm">
            طراحی فرم ایجاد {definition.singularLabel}
          </Button>
        }
        description="پس از آماده‌شدن API و Migration، نتیجه جست‌وجو یا اولین رکورد اینجا نمایش داده می‌شود."
        icon={DatabaseZap}
        title={`هنوز ${definition.label} پایدار در دسترس نیست`}
      />
    );
  }

  const primaryValue =
    definition.preview.name ??
    definition.preview.displayName ??
    definition.preview.legalName ??
    definition.singularLabel;
  const secondaryEntries = Object.entries(definition.preview).filter(
    ([key]) => !['name', 'displayName', 'legalName'].includes(key),
  );

  return (
    <div className="space-y-3">
      <Alert
        description="این ردیف صرفاً برای بازبینی layout و فرم است؛ شناسه پایدار ندارد و در هیچ storage ذخیره نشده است."
        title={MASTER_DATA_PREVIEW_DISCLOSURE}
        tone="warning"
      />
      <div className="grid gap-4 rounded-xl border border-border p-4 md:grid-cols-[1fr_1.4fr_auto] md:items-center">
        <div>
          <p className="text-sm font-black text-foreground">{primaryValue}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {definition.singularLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {secondaryEntries.slice(0, 3).map(([key, value]) => (
            <Badge key={key}>{value || '—'}</Badge>
          ))}
          <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
            فعال
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button onClick={onView} size="sm" variant="outline">
            <Eye aria-hidden="true" className="size-4" />
            مشاهده
          </Button>
          <Button onClick={onEdit} size="sm" variant="outline">
            <FilePenLine aria-hidden="true" className="size-4" />
            ویرایش
          </Button>
        </div>
      </div>
    </div>
  );
}

export function MasterDataTableState(props: MasterDataStatePanelProps) {
  return (
    <DataTableShell
      columns={['عنوان', 'مشخصات مرجع', 'وضعیت و عملیات']}
      empty={<MasterDataStatePanel {...props} />}
    />
  );
}
