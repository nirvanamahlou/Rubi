'use client';
import { useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/form-controls';

export type DetailChoice = { id: string; cells: string[] };

export function DetailPicker({
  label,
  value,
  columns,
  rows,
  onSelect,
  onEdit,
  onType,
  onSearch,
  footer,
  message,
  disabled,
  required,
  wide,
}: {
  label: string;
  value: string;
  columns: string[];
  rows: DetailChoice[];
  onSelect: (id: string) => void;
  onEdit?: (id: string) => void;
  onType?: (value: string) => void;
  onSearch?: (value: string) => void;
  footer?: ReactNode;
  message?: string | undefined;
  disabled?: boolean;
  required?: boolean;
  wide?: 'start' | 'end';
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const visible = onSearch
    ? rows
    : rows.filter((row) => row.cells.join(' ').includes(search.trim()));
  function toggle(next: boolean) {
    setOpen(next);
    setSearch('');
    onSearch?.('');
  }
  return (
    <div
      className="relative min-w-0"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.preventDefault();
          toggle(false);
          trigger.current?.focus();
        }
      }}
    >
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {required ? ' *' : ''}
      </label>
      <div className="flex items-stretch">
        <Input
          id={id}
          value={value}
          readOnly={!onType}
          disabled={disabled}
          required={required}
          onChange={(e) => onType?.(e.target.value)}
          onClick={() => {
            if (!onType) toggle(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              toggle(true);
            }
          }}
        />
        <button
          type="button"
          ref={trigger}
          aria-label={label + '، باز کردن فهرست'}
          aria-expanded={open}
          aria-controls={id + '-list'}
          disabled={disabled}
          className="rounded border px-2"
          onClick={() => toggle(!open)}
        >
          <ChevronDown size={16} />
        </button>
      </div>
      {open && (
        <div
          data-detail-options
          id={id + '-list'}
          className={`absolute z-40 mt-1 max-h-80 overflow-auto rounded-md border bg-background p-2 shadow-lg ${wide ? (wide === 'start' ? 'start-0 w-[min(54rem,85vw)]' : 'end-0 w-[min(54rem,85vw)]') : 'start-0 w-full'}`}
        >
          <Input
            autoFocus
            aria-label={'جست‌وجو در ' + label}
            placeholder="جست‌وجو…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              onSearch?.(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault();
            }}
          />
          <table
            className={
              wide
                ? 'w-full min-w-max text-start text-xs'
                : 'w-full text-start text-xs'
            }
          >
            <thead>
              <tr>
                {columns.map((col) => (
                  <th className="p-1 text-start" key={col}>
                    {col}
                  </th>
                ))}
                {onEdit && <th>ویرایش</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.id}
                  className="border-t hover:bg-muted"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelect(row.id);
                    toggle(false);
                    trigger.current?.focus();
                  }}
                >
                  {row.cells.map((cell, i) => (
                    <td className="p-1" key={columns[i]}>
                      {i === 0 ? (
                        <button type="button" className="text-start">
                          {cell}
                        </button>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                  {onEdit && (
                    <td>
                      <button
                        type="button"
                        aria-label={'ویرایش ' + row.cells[0]}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(false);
                          onEdit(row.id);
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {message ? (
            <p role="status">{message}</p>
          ) : (
            !visible.length && <p className="p-2 text-xs">موردی یافت نشد.</p>
          )}
          {footer && (
            <div className="flex gap-3 border-t p-1 text-sm">{footer}</div>
          )}
        </div>
      )}
    </div>
  );
}
