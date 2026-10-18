'use client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/overlays';
export interface DeleteTarget {
  id: string;
  name: string;
  kind: 'user' | 'role';
  revision?: string;
}
export function IamDeleteDialog({
  target,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  target: DeleteTarget | null;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={Boolean(target)}
      onOpenChange={(open) => {
        if (!open && !busy) onCancel();
      }}
    >
      <DialogContent
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogTitle>
          {target?.kind === 'role' ? 'تأیید حذف دائمی نقش' : 'تأیید حذف کاربر'}
        </DialogTitle>
        <DialogDescription>
          <strong className="block">{target?.name}</strong>
          {target?.kind === 'role'
            ? 'این نقش برای همیشه حذف می‌شود. نقش‌های سیستمی یا متصل به کاربر قابل حذف نیستند.'
            : 'این حساب برای همیشه حذف می‌شود. حساب دارای سوابق وابسته قابل حذف نیست؛ سوابق کاری پاک نمی‌شوند.'}
        </DialogDescription>
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-destructive/30 p-3 text-destructive"
          >
            {error}
          </p>
        )}
        <div className="mt-5 flex gap-3">
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? 'در حال حذف…' : 'تأیید و حذف دائمی'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onCancel}
          >
            انصراف
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
