'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { UserUnitSelect, type UserUnitOption } from './user-unit-select';

export function UserDetailsEditor({
  user,
  canManage,
  request,
  onSaved,
  units = [],
  branchIds = [],
}: {
  user: {
    id: string;
    displayName: string;
    detailsRevision: string;
    organizationUnitId?: string | null;
  };
  units?: UserUnitOption[];
  branchIds?: string[];
  canManage: boolean;
  request: (path: string, init?: RequestInit) => Promise<unknown>;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(user.displayName);
  const [unitId, setUnitId] = useState(user.organizationUnitId ?? '');
  const unitChanged = unitId !== (user.organizationUnitId ?? '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  async function save() {
    if (saving.current || !canManage) return;
    const displayName = name.trim();
    if (displayName === user.displayName && !unitChanged) return;
    if (displayName.length < 2 || displayName.length > 160) {
      setMessage('نام و نام خانوادگی باید بین ۲ تا ۱۶۰ نویسه باشد.');
      return;
    }
    saving.current = true;
    setBusy(true);
    setMessage('');
    try {
      await request(`/iam/users/${user.id}/details`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName,
          revision: user.detailsRevision,
          ...(unitChanged ? { organizationUnitId: unitId || null } : {}),
        }),
      });
      await onSaved();
      setMessage('مشخصات کاربر ذخیره شد.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ذخیره انجام نشد.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="grid gap-3" aria-label="ویرایش مشخصات کاربر">
      <label>
        نام و نام خانوادگی
        <Input
          value={name}
          maxLength={160}
          disabled={!canManage || busy}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <UserUnitSelect
        value={unitId}
        units={units}
        branchIds={branchIds}
        disabled={!canManage || busy}
        onChange={setUnitId}
      />
      <Button type="button" disabled={!canManage} loading={busy} onClick={save}>
        ذخیره مشخصات کاربر
      </Button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
