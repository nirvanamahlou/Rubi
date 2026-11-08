'use client';
import { useRef, useState } from 'react';
import { HrButton } from './hr-controls';
import { hrRequest } from './hr-api';
import type { HrStore } from './hr-store';
import ui from './hr-unified.module.css';

export function HrCompanyCreate({ store }: { store: HrStore }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const id = useRef('');
  if (!store.data?.capabilities.manageCompanies) return null;
  return (
    <div className={ui.spaced}>
      <HrButton
        disabled={busy}
        onClick={() => {
          setOpen(!open);
          setError('');
        }}
      >
        تعریف شرکت
      </HrButton>
      {open ? (
        <form
          className={ui.filters}
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            setBusy(true);
            setError('');
            try {
              id.current ||= crypto.randomUUID();
              await hrRequest('/companies', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ id: id.current, name }),
              });
              await store.refresh();
              id.current = '';
              setName('');
              setOpen(false);
            } catch (error) {
              setError(
                error instanceof Error ? error.message : 'ثبت شرکت انجام نشد.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className={ui.field}>
            نام شرکت
            <input
              required
              maxLength={160}
              value={name}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <HrButton primary type="submit" disabled={busy || !name.trim()}>
            ثبت شرکت
          </HrButton>
          {error ? (
            <p role="alert" className={ui.error}>
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
