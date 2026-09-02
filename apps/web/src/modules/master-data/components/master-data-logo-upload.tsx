'use client';

import { ImageUp, LoaderCircle, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { MasterDataResource } from '@rubi/contracts';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { Badge } from '@/components/ui/surfaces';
import { masterDataApi } from '../api/client';

export function MasterDataLogoUpload({
  disabled,
  label,
  onChange,
  recordId,
  resource,
  title,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  recordId?: string;
  resource: MasterDataResource;
  title: string;
  value: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-xs font-bold text-primary">
          <ImageUp aria-hidden="true" className="size-4" />
          PNG یا JPEG
        </span>
        {value ? <Badge>لوگو بارگذاری شده</Badge> : null}
      </div>
      <Input
        accept="image/png,image/jpeg"
        aria-label={label}
        className="cursor-pointer pt-2"
        disabled={disabled || uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setUploading(true);
          setError('');
          void masterDataApi
            .uploadLogo({
              file,
              resource,
              title,
              ...(recordId ? { recordId } : {}),
            })
            .then((result) => onChange(result.id))
            .catch((caught) =>
              setError(
                caught instanceof Error
                  ? caught.message
                  : 'بارگذاری لوگو ناموفق بود.',
              ),
            )
            .finally(() => setUploading(false));
        }}
        type="file"
      />
      <div className="flex min-h-8 items-center justify-between gap-2">
        <span
          className="text-xs text-destructive"
          role={error ? 'alert' : undefined}
        >
          {error}
        </span>
        {uploading ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            در حال بارگذاری امن
          </span>
        ) : value && !disabled ? (
          <Button
            onClick={() => onChange('')}
            size="sm"
            type="button"
            variant="outline"
          >
            <Trash2 aria-hidden="true" className="size-4" /> حذف لوگو
          </Button>
        ) : null}
      </div>
    </div>
  );
}
