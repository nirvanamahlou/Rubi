'use client';
import { useEffect, useState } from 'react';
import type { TravelWorkflowStateV1, VoucherSettingsV1 } from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { defaultVoucherSettings } from '../model/voucher-settings';
import { travelRequest } from './travel-workflow-form';
import type { ReservationFormIntake } from '../model/reservation-form';

type Choice = { id: string; name: string; phoneMasked?: string };
type Props = {
  intake: ReservationFormIntake;
  onDirty: () => void;
  onSaved: (state: TravelWorkflowStateV1) => void;
};

async function createLeader(path: string, name: string, phone: string) {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('نشانی سرور تنظیم نشده است.');
  const send = () =>
    fetch(`${base}/${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone }),
    });
  let response = await send();
  if (response.status === 401 && (await refreshAuthenticatedSession(base)))
    response = await send();
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      result?.error?.message || result?.message || 'ثبت تورلیدر انجام نشد.',
    );
  return result as { data: Choice };
}

export function VoucherLeaderEditor({ intake, onDirty, onSaved }: Props) {
  const [draft, setDraft] = useState<VoucherSettingsV1>(() => {
    const source = structuredClone(intake);
    if (
      !source.workflow.voucherSettings &&
      source.workflow.supplierFormSettings
    )
      source.workflow.voucherSettings = source.workflow.supplierFormSettings;
    return defaultVoucherSettings(source, {});
  });
  const [brokers, setBrokers] = useState<Choice[]>([]);
  const [leaders, setLeaders] = useState<Choice[]>([]);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const path = `reservations/requests/${intake.id}/voucher-brokers`;
  useEffect(() => {
    let active = true;
    void travelRequest<{ data: Choice[] }>(
      `${path}?search=${encodeURIComponent(search)}`,
    )
      .then((r) => {
        if (active) setBrokers(r.data);
      })
      .catch((e) => {
        if (active) setError(String(e.message));
      });
    return () => {
      active = false;
    };
  }, [path, search]);
  useEffect(() => {
    if (!draft.brokerId) {
      return;
    }
    let active = true;
    void travelRequest<{ data: Choice[] }>(`${path}/${draft.brokerId}/leaders`)
      .then((r) => {
        if (active) setLeaders(r.data);
      })
      .catch((e) => {
        if (active) setError(String(e.message));
      });
    return () => {
      active = false;
    };
  }, [path, draft.brokerId]);
  function change(next: VoucherSettingsV1) {
    setDraft(next);
    onDirty();
  }
  async function chooseLeader(id: string) {
    if (!draft.brokerId) return;
    if (!id) {
      const next = { ...draft };
      delete next.leaderId;
      change({
        ...next,
        text: { ...draft.text, leaderName: '', leaderPhone: '' },
        flags: { ...draft.flags, tourLeader: false },
      });
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await travelRequest<{
        data: { id: string; name: string; phone: string };
      }>(`${path}/${draft.brokerId}/leaders/${id}/contact`);
      change({
        ...draft,
        leaderId: id,
        text: {
          ...draft.text,
          leaderName: r.data.name,
          leaderPhone: r.data.phone,
        },
        flags: { ...draft.flags, tourLeader: true },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'دریافت شماره انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  async function addLeader() {
    if (!draft.brokerId) return;
    setBusy(true);
    setError('');
    try {
      const r = await createLeader(
        `${path}/${draft.brokerId}/leaders`,
        newName.trim(),
        newPhone.trim(),
      );
      const list = await travelRequest<{ data: Choice[] }>(
        `${path}/${draft.brokerId}/leaders`,
      );
      setLeaders(list.data);
      setNewName('');
      setNewPhone('');
      await chooseLeader(r.data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت تورلیدر انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!draft.brokerId || !draft.text.broker) {
      setError('کارگزار را انتخاب کنید.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await travelRequest<{ data: TravelWorkflowStateV1 }>(
        `reservations/requests/${intake.id}/workflow`,
        {
          action: 'VOUCHER_SETTINGS',
          expectedVersion: intake.workflow.version,
          note: 'تنظیمات کارگزار، ترانسفر و تورلیدر واچر',
          voucherSettings: draft,
        },
      );
      onSaved(r.data);
      window.dispatchEvent(new Event('reservation-workflow-changed'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیره انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="grid gap-3 rounded border border-border p-3">
      <h3 className="font-semibold">اطلاعات کارگزار و تورلیدر واچر</h3>
      <label>
        جست‌وجوی کارگزار
        <Input value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      <label>
        کارگزار
        <select
          className="w-full rounded border border-border bg-surface p-2"
          value={draft.brokerId || ''}
          onChange={(e) => {
            const broker = brokers.find((item) => item.id === e.target.value);
            setLeaders([]);
            const next = { ...draft };
            delete next.leaderId;
            delete next.brokerId;
            change({
              ...next,
              ...(broker ? { brokerId: broker.id } : {}),
              text: {
                ...draft.text,
                broker: broker?.name || '',
                leaderName: '',
                leaderPhone: '',
              },
              flags: { ...draft.flags, tourLeader: false },
            });
          }}
        >
          <option value="">انتخاب کارگزار</option>
          {brokers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Board کارگزار برای ترانسفر
        <Input
          value={draft.text.transferBoard || ''}
          onChange={(e) =>
            change({
              ...draft,
              text: { ...draft.text, transferBoard: e.target.value },
            })
          }
        />
      </label>
      <label>
        تورلیدر کارگزار
        <select
          className="w-full rounded border border-border bg-surface p-2"
          disabled={!draft.brokerId || busy}
          value={draft.leaderId || ''}
          onChange={(e) => void chooseLeader(e.target.value)}
        >
          <option value="">بدون تورلیدر</option>
          {leaders.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
              {l.phoneMasked ? ` · ${l.phoneMasked}` : ''}
            </option>
          ))}
        </select>
      </label>
      {draft.text.leaderName && (
        <p>
          تورلیدر واچر: {draft.text.leaderName} · {draft.text.leaderPhone}
        </p>
      )}
      {draft.brokerId && (
        <div className="grid gap-2 rounded border border-border p-2">
          <strong>افزودن تورلیدر به همین کارگزار</strong>
          <Input
            aria-label="نام تورلیدر جدید"
            placeholder="نام تورلیدر"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Input
            aria-label="شماره تورلیدر جدید"
            placeholder="شماره تماس"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
          />
          <Button
            disabled={busy || !newName.trim() || !newPhone.trim()}
            onClick={() => void addLeader()}
          >
            ثبت و انتخاب تورلیدر
          </Button>
        </div>
      )}
      <Button disabled={busy || !draft.brokerId} onClick={() => void save()}>
        ذخیره تنظیمات واچر
      </Button>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
