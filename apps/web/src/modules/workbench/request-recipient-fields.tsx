'use client';
import type { WorkbenchRequestOptionsV1 } from '@nora/contracts';
import { Building2, UserRound } from 'lucide-react';
import { WorkbenchSelect } from './workbench-select';

export function RequestRecipientFields({
  units,
  unitId,
  recipientId,
  disabled,
  onUnitChange,
  onRecipientChange,
}: {
  units: WorkbenchRequestOptionsV1['units'];
  unitId: string;
  recipientId: string;
  disabled: boolean;
  onUnitChange: (id: string) => void;
  onRecipientChange: (id: string) => void;
}) {
  const users = units.find((unit) => unit.id === unitId)?.users ?? [];
  return (
    <>
      <label className="space-y-2 text-sm font-semibold">
        <span className="flex items-center gap-2">
          <Building2 className="size-4 text-primary" aria-hidden="true" />
          واحد مقصد *
        </span>
        <WorkbenchSelect
          label="واحد مقصد"
          value={unitId}
          required
          disabled={disabled || !units.length}
          onValueChange={(id) => {
            onRecipientChange('');
            onUnitChange(id);
          }}
          options={units.map((unit) => ({ value: unit.id, label: unit.name }))}
        />
      </label>
      <label className="space-y-2 text-sm font-semibold">
        <span className="flex items-center gap-2">
          <UserRound className="size-4 text-primary" aria-hidden="true" />
          کاربر گیرنده *
        </span>
        <WorkbenchSelect
          label="کاربر گیرنده"
          value={recipientId}
          required
          disabled={disabled || !users.length}
          onValueChange={onRecipientChange}
          options={users.map((user) => ({
            value: user.id,
            label: `${user.displayName} · ${user.username}`,
          }))}
        />
        {unitId && !users.length ? (
          <p className="text-xs font-normal text-muted-foreground">
            کاربر فعالی برای این واحد در مدیریت سیستم تعریف نشده است.
          </p>
        ) : null}
      </label>
    </>
  );
}
