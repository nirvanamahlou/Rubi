import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { transferDirectionColumns } from './transfer-direction-columns';
import { emptySalesForm, type SalesFormState } from '../model/sales-form';
const state: SalesFormState = {
  ...emptySalesForm,
  tripType: 'ROUND_TRIP',
  serviceKinds: ['TRANSFER'],
};
const row = { key: 'sales-entry-p0', label: 'Passenger 1' };

describe('passenger transfer leg columns', () => {
  it('defaults both checkboxes on and unticks only the chosen leg for the resolved person', () => {
    const patch = vi.fn();
    const columns = transferDirectionColumns(state, patch, () => 'customer');
    expect(columns.map((c) => c.title)).toEqual([
      'ترانسفر رفت',
      'ترانسفر برگشت',
    ]);
    for (const column of columns)
      expect(renderToStaticMarkup(column.render(row))).toContain('checked');
    columns[1]!.render(row).props.onChange();
    expect(patch).toHaveBeenCalledWith({
      passengerTransferDirections: { customer: ['OUTBOUND'] },
    });
    const updated = transferDirectionColumns(
      { ...state, ...patch.mock.calls[0]![0] },
      patch,
      () => 'customer',
    );
    expect(renderToStaticMarkup(updated[0]!.render(row))).toContain('checked');
    expect(renderToStaticMarkup(updated[1]!.render(row))).not.toContain(
      'checked',
    );
    updated[1]!.render(row).props.onChange();
    expect(patch).toHaveBeenLastCalledWith({
      passengerTransferDirections: { customer: ['OUTBOUND', 'RETURN'] },
    });
  });
  it('preserves choices made before identity confirmation, leaves peers unchanged and obeys busy state', () => {
    const patch = vi.fn();
    const input = {
      ...state,
      passengerTransferDirections: { p0: ['RETURN'] as ['RETURN'], peer: [] },
    };
    const columns = transferDirectionColumns(
      input,
      patch,
      () => 'customer',
      true,
    );
    expect(renderToStaticMarkup(columns[0]!.render(row))).not.toContain(
      'checked',
    );
    expect(renderToStaticMarkup(columns[1]!.render(row))).toContain('checked');
    expect(renderToStaticMarkup(columns[1]!.render(row))).toContain('disabled');
    columns[1]!.render(row).props.onChange();
    expect(patch.mock.calls[0]![0].passengerTransferDirections).toEqual({
      p0: ['RETURN'],
      peer: [],
      customer: [],
    });
    expect(
      transferDirectionColumns(
        { ...state, serviceKinds: [] },
        patch,
        (key) => key,
      ),
    ).toEqual([]);
  });
});
