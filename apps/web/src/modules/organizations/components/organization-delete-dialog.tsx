'use client';

import { useRef, useState } from 'react';
import type { IamPermissionCode } from '@rubi/contracts';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import {
  deleteOrganizationRecord,
  type OrganizationDeletionTarget,
} from '../model/record-mutations';

export function OrganizationDeleteDialog({
  target,
  permissions,
  onClose,
  onDeleted,
}: {
  target: OrganizationDeletionTarget;
  permissions: readonly IamPermissionCode[];
  onClose: (refresh: boolean) => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const cancel = useRef<HTMLButtonElement>(null);
  const label = target.resource === 'organizations' ? 'سازمان' : 'مخاطب';
  async function remove() {
    if (pending.current || attempted) return;
    pending.current = true;
    setBusy(true);
    setAttempted(true);
    try {
      await deleteOrganizationRecord(target, permissions);
      onDeleted();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'حذف تأیید نشد.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  function close() {
    if (!pending.current) onClose(attempted);
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="b2b-design b2b-modal organization-delete-modal"
        dir="rtl"
        role="alertdialog"
        onInteractOutside={(event) => event.preventDefault()}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancel.current?.focus();
        }}
      >
        <DialogTitle>حذف دائمی {label}</DialogTitle>
        <DialogDescription>
          {label} «{target.record.name}» با کد <bdi>{target.record.code}</bdi>{' '}
          برای همیشه حذف می‌شود و قابل بازگردانی نیست.
          {target.resource === 'organizations'
            ? ' هویت سازمان و تمام نقش‌های آن حذف می‌شوند. رکورد دارای وابستگی قابل حذف نیست.'
            : ' سازمان و سایر مخاطبان آن باقی می‌مانند.'}
        </DialogDescription>
        {error ? (
          <p role="alert" className="form-error">
            {error} پیش از تلاش مجدد، فهرست تازه‌سازی می‌شود.
          </p>
        ) : null}
        <div className="wizard-actions">
          <Button
            ref={cancel}
            variant="outline"
            disabled={busy}
            onClick={close}
          >
            {attempted ? 'بستن و تازه‌سازی' : 'انصراف'}
          </Button>
          <Button
            variant="destructive"
            loading={busy}
            disabled={attempted || !permissions.includes('master_data.delete')}
            onClick={() => void remove()}
          >
            <Trash2 aria-hidden="true" className="size-4" />
            حذف دائمی {label}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
