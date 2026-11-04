'use client';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/overlays';
import { marketingApi } from '../api/records-client';
export function CampaignDeleteButton({
  campaign,
  onDeleted,
}: {
  campaign: { id: string; name: string; version: number };
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [key, setKey] = useState('');
  return (
    <>
      <Button
        aria-label={`حذف ${campaign.name}`}
        title="حذف"
        size="icon"
        variant="outline"
        className="text-destructive"
        onClick={() => {
          setKey(crypto.randomUUID());
          setError('');
          setOpen(true);
        }}
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent dir="rtl">
          <DialogTitle>حذف کمپین</DialogTitle>
          <DialogDescription>{campaign.name}</DialogDescription>
          {error ? (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              انصراف
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                if (busy) return;
                setBusy(true);
                setError('');
                try {
                  await marketingApi.deleteCampaign(
                    campaign.id,
                    campaign.version,
                    key,
                  );
                  setOpen(false);
                  onDeleted();
                } catch (reason) {
                  setError(
                    reason instanceof Error ? reason.message : 'حذف انجام نشد.',
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              حذف
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
