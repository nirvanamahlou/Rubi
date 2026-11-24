'use client';

import { useRef, useState, type ReactNode } from 'react';
import { SiteDeletionOptions } from '@/components/ui/site-deletion-options';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui';

export function SiteDeleteDialog({
  trigger,
  title,
  description,
  loadSites,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  loadSites: () => Promise<{ data: string[] }>;
  onConfirm: (sites: string[]) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [sites, setSites] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const submittingRef = useRef(false);
  const request = useRef(0);
  function changeOpen(next: boolean) {
    const current = ++request.current;
    setOpen(next);
    if (!next) return;
    setSites(null);
    setSelected([]);
    setFailed(false);
    setDeleteError('');
    void loadSites().then(
      ({ data }) => {
        if (current === request.current) setSites([...new Set(data)]);
      },
      () => {
        if (current === request.current) setFailed(true);
      },
    );
  }

  async function confirm() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setDeleteError('');
    try {
      await onConfirm(selected);
      changeOpen(false);
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : 'ثبت ناموفق بود.',
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submittingRef.current) changeOpen(next);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        {failed && <p role="alert">دریافت فهرست سایت‌ها انجام نشد.</p>}
        {!failed && sites === null && (
          <p role="status">در حال دریافت فهرست سایت‌ها…</p>
        )}
        {sites && (
          <SiteDeletionOptions
            sites={sites}
            selected={selected}
            onChange={setSelected}
            disabled={submitting}
          />
        )}
        {deleteError && (
          <p role="alert" className="text-destructive">
            {deleteError}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <DialogClose asChild>
            <Button variant="ghost" disabled={submitting}>
              انصراف
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={
              submitting || !sites || failed || sites.length !== selected.length
            }
            onClick={() => void confirm()}
          >
            {submitting ? 'در حال ثبت…' : 'تأیید حذف'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
