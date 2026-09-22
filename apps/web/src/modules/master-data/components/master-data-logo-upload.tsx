'use client';

import { ImageUp, Trash2 } from 'lucide-react';
import type { ChangeEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { Badge } from '@/components/ui/surfaces';
import type { MasterDataLogoChange } from '../api/client';

export function MasterDataLogoUpload({
  disabled,
  label,
  onChange,
  pending,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (change: MasterDataLogoChange | undefined) => void;
  pending?: MasterDataLogoChange;
  value: string;
}) {
  const selectedFile = pending?.kind === 'replace' ? pending.file : undefined;
  const hasSavedLogo = Boolean(value) && pending?.kind !== 'remove';

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onChange({ kind: 'replace', file });
  }

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-xs font-bold text-primary">
          <ImageUp aria-hidden="true" className="size-4" />
          PNG یا JPEG
        </span>
        {selectedFile ? (
          <Badge>آماده بارگذاری پس از ذخیره</Badge>
        ) : hasSavedLogo ? (
          <Badge>لوگو بارگذاری شده</Badge>
        ) : pending?.kind === 'remove' ? (
          <Badge>حذف پس از ذخیره</Badge>
        ) : null}
      </div>
      <Input
        accept="image/png,image/jpeg"
        aria-label={label}
        className="cursor-pointer pt-2"
        disabled={disabled}
        onChange={selectFile}
        type="file"
      />
      <div className="flex min-h-8 items-center justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">
          {selectedFile?.name ??
            (pending?.kind === 'remove'
              ? 'لوگو پس از ذخیره از رکورد جدا می‌شود.'
              : 'فایل بعد از دریافت شناسه واقعی رکورد به اسناد ارسال می‌شود.')}
        </span>
        {(selectedFile || hasSavedLogo) && !disabled ? (
          <Button
            onClick={() => onChange(value ? { kind: 'remove' } : undefined)}
            size="sm"
            type="button"
            variant="outline"
          >
            <Trash2 aria-hidden="true" className="size-4" /> حذف لوگو
          </Button>
        ) : pending?.kind === 'remove' && !disabled ? (
          <Button
            onClick={() => onChange(undefined)}
            size="sm"
            type="button"
            variant="outline"
          >
            انصراف از حذف
          </Button>
        ) : null}
      </div>
    </div>
  );
}
