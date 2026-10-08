'use client';

import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useEffectEvent,
  type ReactNode,
} from 'react';
import {
  Plus,
  Save,
  FilePlus2,
  PanelLeftClose,
  Trash2,
  FileX2,
  RefreshCw,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { Button as UiButton, type ButtonProps } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/overlays';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { accountingOperationLabel } from '../accounting-operation-label';

export const accountingOperations = [
  { id: 'new', label: 'جدید', key: 'A', icon: Plus },
  { id: 'save', label: 'ذخیره', key: 'S', icon: Save },
  { id: 'save-new', label: 'ذخیره و جدید', key: 'N', icon: FilePlus2 },
  { id: 'save-close', label: 'ذخیره و بستن', key: 'W', icon: PanelLeftClose },
  { id: 'delete-close', label: 'حذف و بستن', key: 'D', icon: Trash2 },
  { id: 'delete-new', label: 'حذف و جدید', key: 'H', icon: FileX2 },
  { id: 'reload', label: 'بارگذاری مجدد', key: 'R', icon: RefreshCw },
  { id: 'excel', label: 'خروجی اکسل', key: 'E', icon: FileSpreadsheet },
  { id: 'pdf', label: 'خروجی پی دی اف', key: 'P', icon: FileText },
] as const;
type Operation = (typeof accountingOperations)[number]['id'];
type Binding = {
  operation: Operation;
  button: HTMLButtonElement;
  disabled: boolean;
  label: string;
};
const Registry = createContext<{
  set: (id: string, binding: Binding | null) => void;
} | null>(null);
export const useAccountingOperationsActive = () => !!useContext(Registry);

function operationFor(label: string): Operation | undefined {
  const exact = accountingOperations.find((item) => item.label === label)?.id;
  if (exact) return exact;
  if (/^ذخیره (پیش‌نویس|تغییرات|الگو|گروه|حساب|نگاشت|تنظیمات)/.test(label))
    return 'save';
  if (
    /^(سند جدید|پیش‌نویس جدید|دفتر جدید|الگوی جدید|گروه جدید|گروه حساب جدید)$/.test(
      label,
    )
  )
    return 'new';
  if (/^(به‌روزرسانی|تازه‌سازی|دریافت مجدد)$/.test(label)) return 'reload';
  if (/^(خروجی|دریافت).*Excel|^(خروجی|دریافت).*اکسل/.test(label))
    return 'excel';
  if (/^(خروجی|دریافت).*PDF/.test(label)) return 'pdf';
  return undefined;
}

export function AccountingSaveButtons({
  busy,
  permission = 'finance.account.manage',
}: {
  busy: boolean;
  permission?: string;
}) {
  return (
    <>
      {(['ذخیره', 'ذخیره و جدید', 'ذخیره و بستن'] as const).map(
        (label, index) => (
          <AccountingButton
            key={label}
            type="submit"
            name="accountingAfterSave"
            value={index === 1 ? 'new' : index === 2 ? 'close' : 'stay'}
            disabled={busy}
            permission={permission}
          >
            {label}
          </AccountingButton>
        ),
      )}
    </>
  );
}

export function accountingSaveDisposition(event: {
  nativeEvent: Event;
}): 'stay' | 'new' | 'close' {
  const value = (event.nativeEvent as SubmitEvent).submitter?.getAttribute(
    'value',
  );
  return value === 'new' || value === 'close' ? value : 'stay';
}

export function AccountingDeleteButtons({
  busy,
  selected,
  entity,
  run,
  reset,
  close,
}: {
  busy: boolean;
  selected: { id: string; version: number } | null | undefined;
  entity: string;
  run: (
    action: string,
    payload: Record<string, unknown>,
    version?: number,
  ) => Promise<unknown>;
  reset: () => void;
  close: () => void;
}) {
  return (
    <>
      {(['close', 'new'] as const).map((after) => (
        <AccountingButton
          key={after}
          type="button"
          permission="finance.account.manage"
          disabled={busy || !selected}
          onClick={() => {
            if (
              !selected ||
              !window.confirm(
                'رکورد انتخاب‌شده برای همیشه حذف شود؟ رکورد استفاده‌شده حذف نمی‌شود.',
              )
            )
              return;
            void run(
              'delete-base-record',
              { entity, id: selected.id },
              selected.version,
            ).then((result) => {
              if (!result) return;
              reset();
              if (after === 'close') close();
            });
          }}
        >
          {after === 'close' ? 'حذف و بستن' : 'حذف و جدید'}
        </AccountingButton>
      ))}
    </>
  );
}

/** Explicitly moves existing operation buttons to the shared toolbar. Native form
 * submission, permission checks and the original handlers remain the source of truth. */
export const AccountingButton = forwardRef<HTMLButtonElement, ButtonProps>(
  function AccountingButton(props, forwardedRef) {
    const registry = useContext(Registry);
    const permissions = useAccessPermissions();
    const id = useId();
    const ref = useRef<HTMLButtonElement | null>(null);
    const label =
      props['aria-label'] ?? accountingOperationLabel(props.children).trim();
    const operation = operationFor(label);
    const allowed =
      !props.permission || !!permissions?.includes(props.permission);
    const disabled = !!(props.disabled || props.loading);
    useEffect(() => {
      if (!registry || !operation || !allowed || !ref.current) return;
      registry.set(id, { operation, button: ref.current, disabled, label });
      return () => registry.set(id, null);
    }, [registry, operation, allowed, disabled, label, id]);
    return (
      <UiButton
        {...props}
        className={`${props.className ?? ''} ${registry && operation ? 'hidden' : ''}`}
        hidden={(!!registry && !!operation) || props.hidden}
        ref={(element) => {
          ref.current = element;
          if (typeof forwardedRef === 'function') forwardedRef(element);
          else if (forwardedRef) forwardedRef.current = element;
        }}
      />
    );
  },
);

export function AccountingOperations({
  children,
  exportView,
  busy = false,
}: {
  children: ReactNode;
  exportView: (
    format: 'xlsx' | 'pdf',
  ) => Promise<{ url: string; name: string } | undefined>;
  busy?: boolean;
}) {
  const [bindings, setBindings] = useState<Record<string, Binding>>({});
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState<{ url: string; name: string } | null>(null);
  useEffect(
    () => () => {
      if (file) URL.revokeObjectURL(file.url);
    },
    [file],
  );
  const permissions = useAccessPermissions();
  const registry = useMemo(
    () => ({
      set: (id: string, binding: Binding | null) =>
        setBindings((current) => {
          const next = { ...current };
          if (binding) next[id] = binding;
          else delete next[id];
          return next;
        }),
    }),
    [],
  );
  const entries = accountingOperations.map((operation) => {
    const candidates = Object.values(bindings).filter(
      (binding) => binding.operation === operation.id,
    );
    const binding = candidates.find((item) => !item.disabled) ?? candidates[0];
    const exportOperation = operation.id === 'excel' || operation.id === 'pdf';
    const fallbackExport =
      exportOperation &&
      !binding &&
      !!permissions?.includes('finance.export') &&
      !!permissions?.includes('finance.read') &&
      !!permissions?.includes('finance.journal.read');
    return {
      ...operation,
      binding,
      fallbackExport,
      disabled:
        busy ||
        exporting ||
        (!fallbackExport && (!binding || binding.disabled)),
    };
  });
  const invoke = async (id: Operation) => {
    const action = entries.find((item) => item.id === id);
    if (!action || action.disabled) return;
    setError('');
    if (action.binding) {
      action.binding.button.click();
      return;
    }
    setExporting(true);
    try {
      const output = await exportView(id === 'excel' ? 'xlsx' : 'pdf');
      if (output) setFile(output);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'خروجی ساخته نشد.');
    } finally {
      setExporting(false);
    }
  };
  const shortcut = useEffectEvent((event: KeyboardEvent) => {
    if (
      event.defaultPrevented ||
      event.repeat ||
      event.isComposing ||
      !event.altKey ||
      !event.shiftKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    if (
      document.querySelector(
        '[role="dialog"], [role="alertdialog"], [role="menu"][data-state="open"]',
      )
    )
      return;
    const action = entries.find((item) => event.code === `Key${item.key}`);
    if (!action || action.disabled) return;
    event.preventDefault();
    void invoke(action.id);
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => shortcut(event);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);
  return (
    <Registry.Provider value={registry}>
      <div
        role="toolbar"
        aria-label="عملیات مشترک حسابداری"
        className="flex flex-wrap justify-end gap-2 rounded-xl border bg-surface p-3"
      >
        {entries.map((action) => (
          <Tooltip key={action.id}>
            <TooltipTrigger asChild>
              <span tabIndex={action.disabled ? 0 : undefined}>
                <UiButton
                  type="button"
                  size="icon"
                  variant={
                    action.id.startsWith('delete') ? 'destructive' : 'outline'
                  }
                  aria-label={action.label}
                  aria-keyshortcuts={`Alt+Shift+${action.key}`}
                  disabled={action.disabled}
                  onClick={() => void invoke(action.id)}
                >
                  <action.icon className="size-4" />
                </UiButton>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {action.label} · <kbd dir="ltr">Alt+Shift+{action.key}</kbd>
              {action.disabled ? (
                <p>
                  {action.binding
                    ? 'در وضعیت فعلی قابل اجرا نیست.'
                    : 'این عملیات برای نوع صفحه، رکورد انتخاب‌شده یا دسترسی فعلی قابل اجرا نیست.'}
                </p>
              ) : action.fallbackExport ? (
                <p>خروجی اطلاعات نمایش‌داده‌شده در این صفحه</p>
              ) : null}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {file ? (
        <p role="status" className="text-sm">
          <a
            href={file.url}
            download={file.name}
            className="text-primary underline"
          >
            دانلود فایل آماده: {file.name}
          </a>
        </p>
      ) : null}
      {children}
    </Registry.Provider>
  );
}
