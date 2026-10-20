import type { SalesFormState } from '../model/sales-form';
import {
  salesDirections,
  salesPassengerTransferDirections,
} from '../model/sales-form';

export function transferDirectionColumns(
  state: SalesFormState,
  patch: (value: Partial<SalesFormState>) => void,
  resolve: (key: string) => string,
  busy = false,
) {
  return salesDirections(state, 'TRANSFER').map((direction) => ({
    key: `transfer-${direction}`,
    title: direction === 'OUTBOUND' ? 'ترانسفر رفت' : 'ترانسفر برگشت',
    render: (row: { key: string; label: string }) => {
      const key = row.key.replace('sales-entry-', '');
      const id = resolve(key);
      const selected = salesPassengerTransferDirections(
        {
          ...state,
          passengerTransferDirections: {
            ...state.passengerTransferDirections,
            [id]:
              state.passengerTransferDirections?.[id] ??
              state.passengerTransferDirections?.[key] ??
              salesDirections(state, 'TRANSFER'),
          },
        },
        id,
      );
      return (
        <input
          type="checkbox"
          className="size-4 accent-primary"
          aria-label={
            (direction === 'OUTBOUND' ? 'ترانسفر رفت ' : 'ترانسفر برگشت ') +
            row.label
          }
          disabled={busy}
          checked={selected.includes(direction)}
          onChange={() =>
            patch({
              passengerTransferDirections: {
                ...state.passengerTransferDirections,
                [id]: selected.includes(direction)
                  ? selected.filter((d) => d !== direction)
                  : [...selected, direction],
              },
            })
          }
        />
      );
    },
  }));
}
