'use client';
import type { ContactSummary } from './read-client';
import styles from './without-outcome-dialog.module.css';

export type KpiCallMode =
  'without-outcome' | 'missed-callbacks' | 'today' | 'week';

export function KpiCallActions({
  mode,
  call,
  callCount,
  canComplete,
  onComplete,
  onRequest,
  canCreateRequest = false,
}: {
  mode: KpiCallMode;
  call: ContactSummary['latest'];
  callCount: number;
  canComplete: boolean;
  onComplete: (id: string) => Promise<void>;
  canCreateRequest?: boolean;
  onRequest?: ((contact: ContactSummary) => void) | undefined;
}) {
  return (
    <div className={styles.actions}>
      <button
        type="button"
        disabled={!canComplete}
        onClick={() => void onComplete(call.id)}
      >
        ویرایش اطلاعات تماس
      </button>
      {mode === 'missed-callbacks' &&
        canCreateRequest &&
        onRequest &&
        call.contactId && (
          <button
            type="button"
            onClick={() => {
              if (call.contactId)
                onRequest({ id: call.contactId, latest: call, callCount });
            }}
          >
            ثبت درخواست
          </button>
        )}
    </div>
  );
}
