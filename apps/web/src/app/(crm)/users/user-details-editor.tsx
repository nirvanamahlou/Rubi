'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';

export function UserDetailsEditor({
  user,
  canManage,
  request,
  onSaved,
}: {
  user: { id: string; displayName: string; detailsRevision: string };
  canManage: boolean;
  request: (path: string, init?: RequestInit) => Promise<unknown>;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(user.displayName);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  async function save() {
    if (saving.current || !canManage) return;
    const displayName = name.trim();
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
        body: JSON.stringify({ displayName, revision: user.detailsRevision }),
      });
      await onSaved();
      setMessage('نام و نام خانوادگی ذخیره شد.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ذخیره انجام نشد.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="grid gap-3" aria-label="ویرایش نام کاربر">
      <label>
        نام و نام خانوادگی
        <Input
          value={name}
          maxLength={160}
          disabled={!canManage || busy}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <Button
        type="button"
        disabled={!canManage || busy || name.trim() === user.displayName}
        onClick={save}
      >
        ذخیره نام و نام خانوادگی
      </Button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
