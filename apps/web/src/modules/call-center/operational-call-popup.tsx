'use client';
import { useEffect, useState } from 'react';
import { HostedCallForm } from './call-form-host';
import { callCenterRequest } from './client';
import type { AttentionCall } from './telephony-attention';
import type { Call } from './model';

export function refreshCallRecipient(current: Call | null, latest: Call): Call {
  if (!current) return latest;
  const refreshed = { ...current, operator: latest.operator };
  if (latest.answerRecipient)
    refreshed.answerRecipient = latest.answerRecipient;
  else delete refreshed.answerRecipient;
  return refreshed;
}
type OfferedCall = {
  call: Call;
  version: number;
  claimed: boolean;
  canLinkRequests: boolean;
};
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/overlays';

/** Claims only this user's server-issued offer before reading/editing its contact. */
export function OperationalCallPopup({
  row,
  tabId,
  leader,
  onClose,
}: {
  row: AttentionCall;
  tabId: string;
  leader: boolean;
  onClose: () => void;
}) {
  const [call, setCall] = useState<Call | null>(null);
  const [canLinkRequests, setCanLinkRequests] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const sessionId = row.id,
    branch = row.branchId;
  useEffect(() => {
    if (!leader) return;
    let live = true;
    async function load() {
      try {
        const fresh = await callCenterRequest<OfferedCall>(
          `/telephony/${sessionId}`,
          branch,
        );
        if (!live) return;
        if (!fresh.claimed)
          await callCenterRequest(`/telephony/${sessionId}/actions`, branch, {
            method: 'POST',
            body: JSON.stringify({
              version: fresh.version,
              action: 'CLAIM',
              tabId,
            }),
          });
        const result = await callCenterRequest<OfferedCall>(
          `/telephony/${sessionId}`,
          branch,
        );
        if (live) {
          setCall((current) => refreshCallRecipient(current, result.call));
          setCanLinkRequests(result.canLinkRequests);
          setError('');
        }
      } catch (e) {
        if (live)
          setError(
            e instanceof Error ? e.message : 'دریافت اطلاعات تماس انجام نشد.',
          );
      }
    }
    void load();
    return () => {
      live = false;
    };
  }, [sessionId, branch, tabId, leader, retry, row.version]);
  if (!call)
    return (
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent>
          <DialogTitle>اطلاعات تماس</DialogTitle>
          <DialogDescription>دریافت اطلاعات تماس و مخاطب</DialogDescription>
          {error ? (
            <p role="alert">{error}</p>
          ) : (
            <p>در حال دریافت اطلاعات تماس…</p>
          )}
          {error && (
            <button onClick={() => setRetry((n) => n + 1)}>تلاش دوباره</button>
          )}
        </DialogContent>
      </Dialog>
    );
  const previous = { ...call };
  if (!canLinkRequests) delete previous.contactId;
  return (
    <HostedCallForm
      key={call.id}
      branchId={branch}
      event={call}
      previous={{
        ...previous,
        name:
          call.name ||
          (call.direction === 'INBOUND'
            ? (row.technical.callerName ?? '')
            : ''),
      }}
      busy={busy || !leader}
      onClose={onClose}
      onSave={async (value) => {
        if (!leader) throw Error('دریافت در تب دیگری فعال است.');
        setBusy(true);
        try {
          // Answer/hangup may refresh technical fields while the expert is typing.
          // Accept that refresh only if the saved business fields have not changed.
          const refreshed = await callCenterRequest<OfferedCall>(
            `/telephony/${sessionId}`,
            branch,
          );
          const latest = refreshed.call;
          const businessFields = [
            'name',
            'source',
            'subject',
            'note',
            'outcome',
            'ticketId',
          ] as const;
          if (
            businessFields.some(
              (field) =>
                !(
                  field === 'outcome' &&
                  !call.subject &&
                  !latest.subject &&
                  !call.outcome &&
                  latest.outcome === 'NO_ANSWER'
                ) && (latest[field] ?? '') !== (call[field] ?? ''),
            )
          )
            throw Error('اطلاعات تماس تغییر کرده است؛ دوباره بررسی کنید.');
          await callCenterRequest(`/telephony/${sessionId}/actions`, branch, {
            method: 'POST',
            body: JSON.stringify({
              version: refreshed.version,
              action: 'SAVE',
              tabId,
              name: value.name,
              subject: value.subject,
              note: value.note,
              source: value.source,
              operator: value.operator,
              ...(value.outcome ? { outcome: value.outcome } : {}),
              ...(value.ticketId ? { ticketId: value.ticketId } : {}),
            }),
          });
          onClose();
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
