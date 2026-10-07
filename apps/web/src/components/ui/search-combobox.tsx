'use client';
import {
  useId,
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
export type SearchOption = {
  value: string;
  label: ReactNode;
  searchText?: string;
  disabled?: boolean;
};
const VISIBLE_OPTION_LIMIT = 5;
export function optionText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(optionText).join(' ');
  if (node && typeof node === 'object' && 'props' in node)
    return optionText((node.props as { children?: ReactNode }).children);
  return '';
}
export function normalizeOptionSearch(text: string) {
  return text
    .normalize('NFKC')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u200C]/g, '')
    .trim()
    .toLocaleLowerCase();
}
export function searchOptions(
  options: readonly SearchOption[],
  query: string,
  limit = VISIBLE_OPTION_LIMIT,
) {
  const key = normalizeOptionSearch(query);
  return options
    .filter(
      (o) =>
        !key ||
        normalizeOptionSearch(
          `${optionText(o.label)} ${o.searchText ?? ''}`,
        ).includes(key),
    )
    .slice(0, limit);
}
export function dropdownBelowPosition(
  triggerBottom: number,
  viewportHeight: number,
) {
  return {
    top: triggerBottom + 4,
    maxHeight: Math.max(40, viewportHeight - triggerBottom - 12),
  };
}
export function SearchCombobox({
  id: suppliedId,
  value,
  options,
  onValueChange,
  disabled = false,
  required = false,
  label,
  placeholder = 'جست‌وجو و انتخاب…',
  className,
  selectedLabel,
  onSearchChange,
  onOpenChange,
  remote = false,
  loading = false,
  error,
  footer,
  name,
  invalid,
  describedBy,
  style,
  dataAttributes,
  optionLimit = VISIBLE_OPTION_LIMIT,
}: {
  optionLimit?: number;
  id?: string | undefined;
  value: string;
  options: readonly SearchOption[];
  onValueChange: (value: string) => void;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  label?: string | undefined;
  placeholder?: string | undefined;
  className?: string | undefined;
  selectedLabel?: ReactNode;
  onSearchChange?: (query: string) => void;
  onOpenChange?: (open: boolean) => void;
  remote?: boolean;
  loading?: boolean;
  error?: ReactNode;
  footer?: ReactNode;
  name?: string | undefined;
  invalid?: boolean | undefined;
  describedBy?: string | undefined;
  style?: CSSProperties | undefined;
  dataAttributes?: Record<string, unknown>;
}) {
  const generated = useId(),
    id = suppliedId ?? generated,
    input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(''),
    [active, setActive] = useState(0);
  const matches = remote
    ? options.slice(0, VISIBLE_OPTION_LIMIT)
    : searchOptions(options, query, optionLimit);
  const selected = options.find((o) => o.value === value);
  const display = optionText(selectedLabel ?? selected?.label);
  useEffect(() => {
    input.current?.setCustomValidity(
      required && !value ? 'یک گزینه از فهرست انتخاب کنید.' : '',
    );
  }, [required, value]);
  function changeOpen(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
    if (!next) {
      setQuery('');
      setActive(0);
    }
  }
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
        onOpenChange?.(false);
      }
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open, onOpenChange]);
  useLayoutEffect(() => {
    if (!open || !menu.current || !input.current) return;
    const panel = menu.current;
    if (typeof panel.showPopover !== 'function') return;
    if (!panel.matches(':popover-open')) panel.showPopover();
    panel.style.pointerEvents = 'auto';
    const position = () => {
      const rect = input.current!.getBoundingClientRect();
      const placement = dropdownBelowPosition(rect.bottom, window.innerHeight);
      Object.assign(panel.style, {
        position: 'fixed',
        inset: 'auto',
        margin: '0',
        left: rect.left + 'px',
        width: rect.width + 'px',
        top: placement.top + 'px',
        maxHeight: placement.maxHeight + 'px',
        overflowY: 'auto',
      });
    };
    if (
      window.innerHeight - input.current.getBoundingClientRect().bottom <
      96
    ) {
      input.current.scrollIntoView({ block: 'center' });
    }
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [open, matches.length, loading, error]);
  function choose(option: SearchOption) {
    if (option.disabled) return;
    onValueChange(option.value);
    changeOpen(false);
  }
  return (
    <div
      className="relative min-w-0"
      dir="rtl"
      ref={root}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) changeOpen(false);
      }}
    >
      {name ? (
        <input type="hidden" name={name} value={value} disabled={disabled} />
      ) : null}
      <div className="relative">
        <input
          {...dataAttributes}
          style={style}
          ref={input}
          id={id}
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={id + '-list'}
          aria-autocomplete="list"
          aria-required={required || undefined}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          aria-activedescendant={
            open && matches[active] ? id + '-option-' + active : undefined
          }
          autoComplete="off"
          disabled={disabled}
          data-search-select="true"
          className={cn(
            'h-11 w-full rounded-xl border border-input bg-surface px-3 pe-9 text-sm text-foreground shadow-xs outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:opacity-50',
            className,
          )}
          placeholder={placeholder}
          value={open ? query : display}
          onFocus={() => {
            setQuery('');
            setActive(0);
            changeOpen(true);
            onSearchChange?.('');
          }}
          onClick={() => {
            if (!open) {
              changeOpen(true);
              onSearchChange?.('');
            }
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            changeOpen(true);
            onSearchChange?.(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              changeOpen(false);
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              changeOpen(true);
              setActive((n) =>
                Math.max(
                  0,
                  Math.min(
                    matches.length - 1,
                    n + (e.key === 'ArrowDown' ? 1 : -1),
                  ),
                ),
              );
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              if (open && matches[active]) choose(matches[active]);
              else {
                changeOpen(true);
                onSearchChange?.('');
              }
            }
          }}
        />
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
      {open && !disabled ? (
        <div
          ref={menu}
          popover="manual"
          className="absolute top-full z-50 mt-1 w-full rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl"
        >
          <div
            role="listbox"
            id={id + '-list'}
            aria-label={label}
            className="max-h-64 overflow-y-auto overscroll-contain"
          >
            {loading ? (
              <p role="status" className="p-3 text-sm">
                در حال دریافت…
              </p>
            ) : error ? (
              <div role="alert" className="p-3 text-sm">
                {error}
              </div>
            ) : matches.length ? (
              matches.map((o, i) => (
                <button
                  type="button"
                  role="option"
                  key={o.value}
                  id={id + '-option-' + i}
                  disabled={o.disabled}
                  aria-selected={o.value === value}
                  className={cn(
                    'flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-start text-sm disabled:opacity-50',
                    i === active ? 'bg-muted' : 'hover:bg-muted',
                    o.value === value && 'font-semibold text-primary',
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(o)}
                >
                  {o.label}
                  {o.value === value ? (
                    <Check aria-hidden="true" className="size-4 shrink-0" />
                  ) : null}
                </button>
              ))
            ) : (
              <p role="status" className="p-3 text-sm text-muted-foreground">
                موردی پیدا نشد.
              </p>
            )}
          </div>
          {footer}
        </div>
      ) : null}
    </div>
  );
}
