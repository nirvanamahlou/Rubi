'use client';

import { useEffect, useEffectEvent } from 'react';
import {
  Save,
  FilePlus2,
  PanelLeftClose,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  AccountingButton as Button,
  useAccountingOperationsActive,
} from './accounting-operations';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/overlays';

export function AccountingDefinitionToolbar({
  busy,
  canClose,
  save,
  reset,
  refresh,
  close,
  deleteRecord,
}: {
  busy: boolean;
  canClose: boolean;
  save: (after: 'stay' | 'new' | 'close') => void;
  reset: () => void;
  refresh: () => void;
  close: () => void;
  deleteRecord?: (after: 'new' | 'close') => void;
}) {
  const shared = useAccountingOperationsActive();
  const actions = [
    {
      label: 'حذف و بستن',
      key: 'D',
      icon: X,
      run: () => deleteRecord?.('close'),
      disabled: busy || !canClose || !deleteRecord,
      permission: 'finance.account.manage',
    },
    {
      label: 'حذف و جدید',
      key: 'H',
      icon: X,
      run: () => deleteRecord?.('new'),
      disabled: busy || !deleteRecord,
      permission: 'finance.account.manage',
    },
    {
      label: 'ذخیره',
      key: 'S',
      icon: Save,
      run: () => save('stay'),
      disabled: busy,
      permission: 'finance.account.manage',
    },
    {
      label: 'ذخیره و جدید',
      key: 'N',
      icon: FilePlus2,
      run: () => save('new'),
      disabled: busy,
      permission: 'finance.account.manage',
    },
    {
      label: 'ذخیره و بستن',
      key: 'W',
      icon: PanelLeftClose,
      run: () => save('close'),
      disabled: busy || !canClose,
      permission: 'finance.account.manage',
    },
    { label: 'جدید', key: 'A', icon: Plus, run: reset, disabled: busy },
    {
      label: 'بارگذاری مجدد',
      key: 'R',
      icon: RefreshCw,
      run: refresh,
      disabled: busy,
    },
    {
      label: 'بستن',
      key: 'X',
      icon: X,
      run: close,
      disabled: busy || !canClose,
    },
  ];
  const onKey = useEffectEvent((event: KeyboardEvent) => {
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
    if (document.querySelector('[role="dialog"], [role="menu"]')) return;
    const action = actions.find((item) => event.code === `Key${item.key}`);
    if (!action || action.disabled) return;
    // Click the same permission-aware button, keeping keyboard and pointer behavior identical.
    const button = document.querySelector<HTMLButtonElement>(
      `[data-definition-action="${action.key}"]`,
    );
    if (!button || button.disabled) return;
    event.preventDefault();
    button.click();
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);
  return (
    <div
      role="toolbar"
      aria-label="عملیات فرم تعریف"
      className="flex justify-end gap-2 border-b pb-3"
    >
      {actions.map((action) => (
        <Tooltip key={action.key}>
          <TooltipTrigger asChild>
            <span
              hidden={shared && action.label !== 'بستن'}
              tabIndex={!shared && action.disabled ? 0 : undefined}
            >
              <Button
                type="button"
                size="sm"
                variant="outline"
                {...(action.permission
                  ? { permission: action.permission }
                  : {})}
                disabled={action.disabled}
                aria-label={action.label}
                aria-keyshortcuts={`Alt+Shift+${action.key}`}
                data-definition-action={action.key}
                onClick={action.run}
              >
                <action.icon className="size-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {action.label} · <kbd dir="ltr">Alt+Shift+{action.key}</kbd>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
