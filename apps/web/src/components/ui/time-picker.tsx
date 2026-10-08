'use client';

import * as React from 'react';
import { Clock3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDisplayLanguage } from '@/i18n/locale-context';

export function timeSeconds(value: string): number | null {
  const parts = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!parts) return null;
  const hour = Number(parts[1]),
    minute = Number(parts[2]),
    second = Number(parts[3] ?? 0);
  return hour < 24 && minute < 60 && second < 60
    ? hour * 3600 + minute * 60 + second
    : null;
}

export function allowedTime(
  value: string,
  min?: string,
  max?: string,
  step?: string | number,
  base = '',
) {
  const seconds = timeSeconds(value);
  if (seconds === null) return false;
  const lower = min ? timeSeconds(min) : null,
    upper = max ? timeSeconds(max) : null;
  if (lower !== null && upper !== null && lower > upper) {
    if (seconds < lower && seconds > upper) return false;
  } else if (
    (lower !== null && seconds < lower) ||
    (upper !== null && seconds > upper)
  )
    return false;
  if (step === 'any') return true;
  const increment = Number(step ?? 60);
  return (
    increment > 0 &&
    (seconds - (lower ?? timeSeconds(base) ?? 0)) % increment === 0
  );
}

/** A canonical 24-hour field; the browser never supplies a time picker. */
export const TimePicker = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(
  (
    {
      value,
      defaultValue,
      onChange,
      className,
      disabled,
      readOnly,
      min,
      max,
      step,
      id,
      onKeyDown,
      onFocus,
      ...props
    },
    forwardedRef,
  ) => {
    const english = useDisplayLanguage() === 'en';
    const [internal, setInternal] = React.useState(String(defaultValue ?? ''));
    const current = value === undefined ? internal : String(value);
    const [open, setOpen] = React.useState(false);
    const [part, setPart] = React.useState<'hour' | 'minute'>('hour');
    const input = React.useRef<HTMLInputElement>(null);
    const root = React.useRef<HTMLDivElement>(null);
    const panel = React.useRef<HTMLDivElement>(null);
    const generatedId = React.useId();
    const fieldId = id ?? generatedId;
    const minimum = min === undefined ? undefined : String(min),
      maximum = max === undefined ? undefined : String(max);
    React.useImperativeHandle(forwardedRef, () => input.current!);
    React.useEffect(() => {
      const form = input.current?.form;
      if (!form || value !== undefined) return;
      const reset = () => {
        setInternal(String(defaultValue ?? ''));
        setOpen(false);
      };
      form.addEventListener('reset', reset);
      return () => form.removeEventListener('reset', reset);
    }, [value, defaultValue]);
    React.useEffect(() => {
      input.current?.setCustomValidity(
        current &&
          !allowedTime(
            current,
            minimum,
            maximum,
            step,
            String(defaultValue ?? ''),
          )
          ? english
            ? 'Enter a valid 24-hour time within the allowed range.'
            : 'ساعت ۲۴ساعته معتبر در محدودهٔ مجاز وارد کنید.'
          : '',
      );
    }, [current, minimum, maximum, step, defaultValue, english]);
    React.useEffect(() => {
      if (disabled || readOnly) setOpen(false);
    }, [disabled, readOnly]);
    React.useEffect(() => {
      if (!open) return;
      const close = (event: PointerEvent) => {
        if (!root.current?.contains(event.target as Node)) setOpen(false);
      };
      document.addEventListener('pointerdown', close);
      return () => document.removeEventListener('pointerdown', close);
    }, [open]);
    React.useLayoutEffect(() => {
      const element = panel.current;
      if (!open || !element || !input.current || !element.showPopover) return;
      element.showPopover();
      const position = () => {
        const rect = input.current!.getBoundingClientRect();
        const width = Math.min(300, window.innerWidth - 24);
        const height = Math.min(330, window.innerHeight - 24);
        Object.assign(element.style, {
          position: 'fixed',
          inset: 'auto',
          margin: '0',
          width: `${width}px`,
          left: `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`,
          top: `${Math.max(12, Math.min(rect.bottom + 4, window.innerHeight - height - 12))}px`,
          maxHeight: `${height}px`,
        });
      };
      position();
      window.addEventListener('resize', position);
      window.addEventListener('scroll', position, true);
      return () => {
        window.removeEventListener('resize', position);
        window.removeEventListener('scroll', position, true);
      };
    }, [open]);
    const commit = (next: string, event: React.SyntheticEvent) => {
      setInternal(next);
      if (!input.current) return;
      input.current.value = next;
      onChange?.({
        ...event,
        type: 'change',
        target: input.current,
        currentTarget: input.current,
      } as React.ChangeEvent<HTMLInputElement>);
    };
    const hours = timeSeconds(current) === null ? '00' : current.slice(0, 2);
    const minutes = timeSeconds(current) === null ? '00' : current.slice(3, 5);
    const nextValue = (number: number) => {
      const selected = String(number).padStart(2, '0');
      return `${part === 'hour' ? selected : hours}:${part === 'minute' ? selected : minutes}${current.length === 8 ? current.slice(5) : ''}`;
    };
    return (
      <div
        ref={root}
        className="relative min-w-0 flex-1"
        dir="ltr"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setOpen(false);
        }}
      >
        <input
          {...props}
          id={fieldId}
          ref={input}
          type="text"
          role="combobox"
          aria-haspopup="dialog"
          dir="ltr"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          readOnly={readOnly}
          value={current}
          placeholder={props.placeholder ?? 'HH:mm'}
          className={cn(
            'h-11 w-full rounded-xl border border-input bg-surface px-3 pe-10 text-center text-sm tabular-nums text-foreground shadow-xs outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:opacity-50',
            className,
          )}
          aria-controls={open ? `${fieldId}-time-options` : undefined}
          aria-expanded={open}
          onChange={(event) => {
            setInternal(event.target.value);
            onChange?.(event);
          }}
          onFocus={onFocus}
          onClick={(event) => {
            props.onClick?.(event);
            if (!event.defaultPrevented && !disabled && !readOnly)
              setOpen(true);
          }}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (!event.defaultPrevented && event.key === 'Escape')
              setOpen(false);
            if (
              !event.defaultPrevented &&
              !disabled &&
              !readOnly &&
              event.key === 'ArrowDown'
            ) {
              event.preventDefault();
              setOpen(true);
            }
          }}
        />
        <button
          type="button"
          disabled={disabled || readOnly}
          aria-label={english ? 'Choose time' : 'انتخاب ساعت'}
          aria-expanded={open}
          className="absolute inset-y-0 end-1 flex w-8 items-center justify-center rounded-lg text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          onClick={() => {
            setPart('hour');
            setOpen(!open);
          }}
        >
          <Clock3 className="size-4" aria-hidden="true" />
        </button>
        {open ? (
          <div
            ref={panel}
            popover="manual"
            id={`${fieldId}-time-options`}
            role="dialog"
            aria-label={english ? 'Choose time' : 'انتخاب ساعت'}
            className="absolute top-full z-50 mt-1 w-72 overflow-auto rounded-xl border border-input bg-surface p-3 text-foreground shadow-xl"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                setOpen(false);
                input.current?.focus();
              }
            }}
          >
            <div className="mb-3 flex gap-2" dir="ltr">
              {(['hour', 'minute'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={part === item}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2 text-sm font-semibold',
                    part === item
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input bg-surface',
                  )}
                  onClick={() => setPart(item)}
                >
                  {item === 'hour'
                    ? english
                      ? 'Hour'
                      : 'ساعت'
                    : english
                      ? 'Minute'
                      : 'دقیقه'}{' '}
                  · {item === 'hour' ? hours : minutes}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-6 gap-1" dir="ltr">
              {Array.from(
                { length: part === 'hour' ? 24 : 60 },
                (_, number) => {
                  const next = nextValue(number);
                  const allowed =
                    part === 'hour'
                      ? Array.from({ length: 60 }, (_, minute) =>
                          allowedTime(
                            `${String(number).padStart(2, '0')}:${String(minute).padStart(2, '0')}${current.length === 8 ? current.slice(5) : ''}`,
                            minimum,
                            maximum,
                            step,
                            String(defaultValue ?? ''),
                          ),
                        ).some(Boolean)
                      : allowedTime(
                          next,
                          minimum,
                          maximum,
                          step,
                          String(defaultValue ?? ''),
                        );
                  const selected =
                    number === Number(part === 'hour' ? hours : minutes);
                  return (
                    <button
                      type="button"
                      key={number}
                      disabled={!allowed}
                      aria-pressed={selected}
                      className={cn(
                        'rounded-lg p-2 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30',
                        selected
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-primary/10',
                      )}
                      onClick={(event) => {
                        if (
                          allowedTime(
                            next,
                            minimum,
                            maximum,
                            step,
                            String(defaultValue ?? ''),
                          )
                        )
                          commit(next, event);
                        else {
                          const minute = Array.from(
                            { length: 60 },
                            (_, n) => n,
                          ).find((n) =>
                            allowedTime(
                              `${String(number).padStart(2, '0')}:${String(n).padStart(2, '0')}`,
                              minimum,
                              maximum,
                              step,
                              String(defaultValue ?? ''),
                            ),
                          );
                          if (minute !== undefined)
                            commit(
                              `${String(number).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
                              event,
                            );
                        }
                        if (part === 'hour') setPart('minute');
                        else {
                          setOpen(false);
                          input.current?.focus();
                        }
                      }}
                    >
                      {String(number).padStart(2, '0')}
                    </button>
                  );
                },
              )}
            </div>
          </div>
        ) : null}
      </div>
    );
  },
);
TimePicker.displayName = 'TimePicker';
