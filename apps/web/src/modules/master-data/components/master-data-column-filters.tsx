'use client';

import {
  getMasterDataColumnFilters,
  type MasterDataResource,
} from '@rubi/contracts';
import { useMemo, useState } from 'react';
import {
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export function useMasterDataColumnFilters(
  resource: MasterDataResource,
  onChange: () => void,
) {
  const [selection, setSelection] = useState({ resource, values: ['', ''] });
  const columnFilters = useMemo(() => {
    const values = selection.resource === resource ? selection.values : [];
    return {
      ...(values[0] ? { columnFilter1: values[0] } : {}),
      ...(values[1] ? { columnFilter2: values[1] } : {}),
    };
  }, [resource, selection]);
  function change(index: number, value: string) {
    const values =
      selection.resource === resource ? [...selection.values] : ['', ''];
    values[index] = value;
    setSelection({ resource, values });
    onChange();
  }
  const resetColumnFilters = () => setSelection({ resource, values: ['', ''] });
  const columnFilterControls = getMasterDataColumnFilters(resource).map(
    (filter, index) => {
      const value =
        selection.resource === resource ? (selection.values[index] ?? '') : '';
      const id = `${resource}-column-filter-${index}`;
      return (
        <FormField label={filter.label} id={id} key={id}>
          <div className="flex items-center gap-1">
            {filter.options ? (
              <Select
                value={value || '__all'}
                onValueChange={(next) =>
                  change(index, next === '__all' ? '' : next)
                }
              >
                <SelectTrigger id={id} aria-label={`فیلتر ${filter.label}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">همه موارد</SelectItem>
                  {filter.options.map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={id}
                aria-label={`فیلتر ${filter.label}`}
                maxLength={100}
                value={value}
                placeholder={`جست‌وجوی ${filter.label}`}
                onChange={(event) => change(index, event.target.value)}
              />
            )}
            {value ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`پاک‌کردن فیلتر ${filter.label}`}
                onClick={() => change(index, '')}
              >
                <X aria-hidden="true" className="size-4" />
              </Button>
            ) : null}
          </div>
        </FormField>
      );
    },
  );
  return { columnFilters, columnFilterControls, resetColumnFilters };
}
