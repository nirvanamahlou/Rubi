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
  onConfirm: (sites: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [sites, setSites] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const request = useRef(0);
  function changeOpen(next: boolean) {
    const current = ++request.current;
    setOpen(next);
    if (!next) return;
    setSites(null);
    setSelected([]);
    setFailed(false);
    void loadSites().then(
      ({ data }) => {
        if (current === request.current) setSites(data);
      },
      () => {
        if (current === request.current) setFailed(true);
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
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
          />
        )}
        <div className="mt-6 flex justify-end gap-3">
          <DialogClose asChild>
            <Button variant="ghost">انصراف</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={!sites || failed || sites.length !== selected.length}
            onClick={() => {
              changeOpen(false);
              onConfirm(selected);
            }}
          >
            تأیید حذف
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
