'use client';

import { Check, ChevronDown, Search } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import type { MasterDataRecord } from '@rubi/contracts';
import { FormField, Input } from '@/components/ui/form-controls';
import { normalizeRouteSearch } from '../model/sales-form';

export function SearchableReference({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: readonly MasterDataRecord[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(0);
  const selected = options.find((item) => item.id === value);
  const matches = options.filter((item) =>
    normalizeRouteSearch(
      `${item.name} ${item.code} ${item.attributes.englishName ?? ''}`,
    ).includes(normalizeRouteSearch(search)),
  );
  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
    setSearch('');
    input.current?.focus();
  };
  return (
    <FormField id={id} label={label} required>
      <div
        className="relative"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setOpen(false);
            setSearch('');
          }
        }}
      >
        <div className="relative">
          <Input
            ref={input}
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            aria-autocomplete="list"
            aria-activedescendant={
              open && matches[active] ? `${id}-option-${active}` : undefined
            }
            disabled={disabled}
            autoComplete="off"
            placeholder={
              disabled ? 'ابتدا کشور را انتخاب کنید' : 'جست‌وجو و انتخاب…'
            }
            className="h-10 rounded-xl pe-9 ps-9 text-sm"
            value={open ? search : (selected?.name ?? '')}
            onFocus={() => {
              setOpen(true);
              setSearch('');
              setActive(0);
            }}
            onClick={() => setOpen(true)}
            onChange={(event) => {
              setSearch(event.target.value);
              setActive(0);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                setOpen(false);
                setSearch('');
              }
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                setOpen(true);
                setActive((current) =>
                  Math.max(
                    0,
                    Math.min(
                      matches.length - 1,
                      current + (event.key === 'ArrowDown' ? 1 : -1),
                    ),
                  ),
                );
              }
              if (event.key === 'Enter') {
                event.preventDefault();
                if (open && matches[active]) choose(matches[active].id);
                else setOpen(true);
              }
            }}
          />
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-3 top-3 size-4 text-muted-foreground"
          />
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute end-3 top-3 size-4 text-muted-foreground"
          />
        </div>
        {open && !disabled ? (
          <div className="absolute top-full z-50 mt-2 w-full rounded-2xl border border-border bg-surface p-2 shadow-xl">
            <ul
              id={`${id}-list`}
              role="listbox"
              aria-label={label}
              className="max-h-64 overflow-y-auto overscroll-contain"
            >
              {matches.map((item, index) => (
                <li
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={item.id === value}
                  key={item.id}
                  className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm ${item.id === value ? 'bg-primary/10 font-bold text-primary' : index === active ? 'bg-muted' : 'hover:bg-muted'}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(item.id)}
                >
                  <span>
                    {item.name}{' '}
                    <span className="text-xs text-muted-foreground">
                      {item.code}
                    </span>
                  </span>
                  {item.id === value ? (
                    <Check aria-hidden="true" className="size-4" />
                  ) : null}
                </li>
              ))}
            </ul>
            {!matches.length ? (
              <p role="status" className="p-3 text-sm text-muted-foreground">
                موردی پیدا نشد.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </FormField>
  );
}
