import type { MasterDataRecord } from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';
import { searchOptions } from '@/components/ui/search-combobox';
import { ContractFlightEditor } from './contract-flight-editor';
import type { ContractFlightDraft } from '../model/sales-form';
const flight: ContractFlightDraft = {
  carrierName: 'Old airline',
  serviceNumber: '123',
  departureAt: '',
  arrivalAt: '',
  cabinClassCode: 'ECONOMY',
};
const airline = (
  index: number,
  status: MasterDataRecord['status'] = 'active',
) =>
  ({
    id: String(index),
    resource: 'airlines',
    version: 1,
    createdAt: '2026-10-04T00:00:00Z',
    updatedAt: '2026-10-04T00:00:00Z',
    name: 'Airline ' + index,
    code: 'CODE' + index,
    status,
    attributes: { englishName: 'English ' + index },
  }) as MasterDataRecord;
describe('floating airline selection', () => {
  it('uses active reference suggestions, searches middle text beyond the first five, and snapshots selection without changing the flight', () => {
    const onChange = vi.fn();
    const editor = ContractFlightEditor({
      value: flight,
      airlines: [
        ...Array.from({ length: 8 }, (_, i) => airline(i)),
        airline(9, 'inactive'),
      ],
      onChange,
    });
    const picker = editor.props.children[2].props.children[0].props.children;
    expect(searchOptions(picker.props.options, '')).toHaveLength(5);
    expect(
      searchOptions(picker.props.options, 'glish 7').map((o) => o.value),
    ).toEqual(['Airline 7']);
    expect(searchOptions(picker.props.options, '9')).toEqual([]);
    expect(picker.props.selectedLabel).toBe('Old airline');
    picker.props.onValueChange('Airline 7');
    expect(onChange).toHaveBeenCalledWith({
      ...flight,
      carrierName: 'Airline 7',
    });
  });
});

it('composes clocks with the previously selected date', () => {
  const onChange = vi.fn();
  const editor = ContractFlightEditor({
    value: flight,
    flightDate: '2026-10-19',
    onChange,
  });
  const fields = editor.props.children[2].props.children;
  expect(fields[2].props.label).toBe('ساعت حرکت');
  fields[2].props.children.props.onChange({ target: { value: '23:00' } });
  expect(onChange).toHaveBeenCalledWith({
    ...flight,
    departureAt: '2026-10-19T23:00',
    arrivalAt: '',
  });
});
