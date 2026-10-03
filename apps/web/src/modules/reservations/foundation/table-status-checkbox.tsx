'use client';
import { useState } from 'react';
import type {
  ReservationTableFlagKey,
  TravelWorkflowStateV1,
} from '@nora/contracts';
import { travelRequest } from '../components/travel-workflow-form';
import type { RequestView } from './model';
export const tableFlagColumns: Partial<
  Record<number, ReservationTableFlagKey>
> = {
  28: 'visaRequested',
  29: 'visaConfirmed',
  30: 'flightRequested',
  31: 'flightConfirmed',
};
export function TableStatusCheckbox({
  row,
  flag,
  label,
  canManage,
}: {
  row: RequestView;
  flag: ReservationTableFlagKey;
  label: string;
  canManage: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const state = row.tableFlags?.[flag];
  const checked = state?.checked === true;
  const hint = state
    ? (state.actorName || state.updatedByUserId) +
      ' · ' +
      new Date(state.updatedAt).toLocaleString('fa-IR')
    : 'ثبت نشده';
  async function toggle() {
    setBusy(true);
    setError('');
    try {
      const { data } = await travelRequest<{
        data: { workflow: TravelWorkflowStateV1 };
      }>('reservations/requests/' + row.id + '/workflow');
      await travelRequest('reservations/requests/' + row.id + '/workflow', {
        action: 'TABLE_STATUS',
        tableFlag: flag,
        checked: !checked,
        expectedVersion: row.workflowVersion ?? data.workflow.version,
        note: (checked ? 'برداشتن تیک ' : 'ثبت تیک ') + label,
      });
      window.dispatchEvent(new Event('reservation-workflow-changed'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیره انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <span title={hint} className="inline-flex flex-col items-center gap-1">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={label + ' · ' + row.contractNumber}
        disabled={!canManage || busy || row.status === 'CANCELLED'}
        onClick={(e) => {
          e.stopPropagation();
          void toggle();
        }}
        className="inline-flex size-5 items-center justify-center rounded border border-current disabled:opacity-60"
      >
        {checked ? '✓' : ''}
      </button>
      {state && (
        <small className="max-w-28 truncate text-[10px]">
          {state.actorName || 'ثبت‌شده'}
          <br />
          {new Date(state.updatedAt).toLocaleString('fa-IR', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </small>
      )}
      {error && (
        <small
          role="alert"
          className="max-w-40 whitespace-normal text-destructive"
        >
          {error}
        </small>
      )}
    </span>
  );
}
