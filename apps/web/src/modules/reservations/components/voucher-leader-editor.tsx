'use client';
import { useEffect, useRef, useState } from 'react';
import type { TravelWorkflowStateV1, VoucherSettingsV1 } from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { defaultVoucherSettings } from '../model/voucher-settings';
import { travelRequest } from './travel-workflow-form';
import type { ReservationFormIntake } from '../model/reservation-form';

type Choice = {
  id: string;
  name: string;
  englishName?: string;
  phoneMasked?: string;
};
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
    const settings = defaultVoucherSettings(source, {});
    const supplier = intake.workflow.sentSupplierFormSettings;
    if (supplier?.brokerId && supplier.brokerId !== settings.brokerId) {
      settings.brokerId = supplier.brokerId;
      settings.text.broker = supplier.text.broker;
      delete settings.leaderId;
      settings.text.leaderName = '';
      settings.text.leaderPhone = '';
      settings.text.transferBoard = '';
    }
    return settings;
  });
  const selectionRequest = useRef(0);
  useEffect(
    () => () => {
      selectionRequest.current += 1;
    },
    [],
  );
  const [brokers, setBrokers] = useState<Choice[]>([]);
  const [leaders, setLeaders] = useState<Choice[]>([]);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [brokersLoading, setBrokersLoading] = useState(true);
  const [leadersLoading, setLeadersLoading] = useState(Boolean(draft.brokerId));
  const [lookupError, setLookupError] = useState('');
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
        if (active)
          setLookupError(
            e instanceof Error ? e.message : 'دریافت کارگزاران انجام نشد.',
          );
      })
      .finally(() => {
        if (active) setBrokersLoading(false);
      });
    // Keep the selected label separate from filtered remote results.
    // Requests use the existing permission-scoped public directory.
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
        if (active)
          setLookupError(
            e instanceof Error ? e.message : 'دریافت تورلیدرها انجام نشد.',
          );
      })
      .finally(() => {
        if (active) setLeadersLoading(false);
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
    if (!draft.brokerId || busy) return;
    const request = ++selectionRequest.current;
    const brokerId = draft.brokerId;
    if (!id) {
      const next = { ...draft };
      delete next.leaderId;
      change({
        ...next,
        text: {
          ...draft.text,
          leaderName: '',
          leaderPhone: '',
          transferBoard: '',
        },
        flags: { ...draft.flags, tourLeader: false },
      });
      return;
    }
    setBusy(true);
    setError('');
    onDirty();
    try {
      const r = await travelRequest<{
        data: { id: string; name: string; phone: string; board?: string };
      }>(`${path}/${brokerId}/leaders/${id}/contact`);
      if (request !== selectionRequest.current) return;
      const next: VoucherSettingsV1 = {
        ...draft,
        leaderId: id,
        text: {
          ...draft.text,
          leaderName: r.data.name,
          leaderPhone: r.data.phone ?? '',
          transferBoard: r.data.board ?? '',
        },
        flags: { ...draft.flags, tourLeader: true },
      };
      setDraft(next);
      await persist(next, request);
    } catch (e) {
      if (request === selectionRequest.current)
        setError(e instanceof Error ? e.message : 'دریافت شماره انجام نشد.');
    } finally {
      if (request === selectionRequest.current) setBusy(false);
    }
  }
  async function addLeader() {
    if (!draft.brokerId) return;
    const request = ++selectionRequest.current;
    const brokerId = draft.brokerId;
    setBusy(true);
    setError('');
    try {
      const r = await createLeader(
        `${path}/${brokerId}/leaders`,
        newName.trim(),
        newPhone.trim(),
      );
      if (request !== selectionRequest.current) return;
      const list = await travelRequest<{ data: Choice[] }>(
        `${path}/${brokerId}/leaders`,
      );
      if (request !== selectionRequest.current) return;
      setLeaders(list.data);
      setNewName('');
      setNewPhone('');
      await chooseLeader(r.data.id);
    } catch (e) {
      if (request === selectionRequest.current)
        setError(e instanceof Error ? e.message : 'ثبت تورلیدر انجام نشد.');
    } finally {
      if (request === selectionRequest.current) setBusy(false);
    }
  }
  async function persist(settings: VoucherSettingsV1, request: number) {
    if (!settings.brokerId || !settings.leaderId || !settings.text.broker) {
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
          voucherSettings: settings,
        },
      );
      if (request !== selectionRequest.current) return;
      onSaved(r.data);
      window.dispatchEvent(new Event('reservation-workflow-changed'));
    } catch (e) {
      if (request === selectionRequest.current)
        setError(
          e instanceof Error
            ? e.message
            : 'ذخیره انجام نشد؛ دوباره ذخیره تنظیمات را بزنید.',
        );
    } finally {
      if (request === selectionRequest.current) setBusy(false);
    }
  }
  return (
    <section className="grid gap-3 rounded border border-border p-3">
      <h3 className="font-semibold">اطلاعات کارگزار و تورلیدر واچر</h3>
      <p className="text-sm text-muted-foreground">
        با انتخاب تورلیدر، Board و مشخصات ثبت‌شدهٔ او خودکار تکمیل و ذخیره
        می‌شود.
      </p>
      <label>
        کارگزار
        <SearchCombobox
          label="جست‌وجو و انتخاب کارگزار واچر"
          placeholder="جست‌وجو و انتخاب کارگزار…"
          remote
          loading={brokersLoading}
          onSearchChange={(query) => {
            if (query === search) return;
            setBrokersLoading(true);
            setLookupError('');
            setSearch(query);
          }}
          selectedLabel={draft.text.broker}
          options={brokers.map((b) => ({
            value: b.id,
            label: b.name,
            searchText: b.englishName ?? '',
          }))}
          value={draft.brokerId || ''}
          disabled={
            busy || Boolean(intake.workflow.sentSupplierFormSettings?.brokerId)
          }
          onValueChange={(id) => {
            selectionRequest.current += 1;
            setBusy(false);
            setError('');
            const broker = brokers.find((item) => item.id === id);
            setLeadersLoading(Boolean(broker));
            setLookupError('');
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
                transferBoard: '',
                leaderName: '',
                leaderPhone: '',
              },
              flags: { ...draft.flags, tourLeader: false },
            });
          }}
        />
      </label>
      <label>
        Board کارگزار برای ترانسفر
        <Input
          value={draft.text.transferBoard || ''}
          readOnly
          aria-label="Board ثبت‌شدهٔ کارگزار"
          placeholder="با انتخاب تورلیدر، خودکار تکمیل می‌شود"
        />
      </label>
      <label>
        تورلیدر کارگزار
        <SearchCombobox
          label="جست‌وجو و انتخاب تورلیدر کارگزار"
          placeholder="جست‌وجو و انتخاب تورلیدر…"
          loading={leadersLoading}
          selectedLabel={draft.text.leaderName}
          options={leaders.map((l) => ({
            value: l.id,
            label: `${l.name}${l.phoneMasked ? ` · ${l.phoneMasked}` : ''}`,
          }))}
          disabled={!draft.brokerId || busy || leadersLoading}
          value={draft.leaderId || ''}
          onValueChange={(id) => void chooseLeader(id)}
        />
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
      <Button
        disabled={busy || !draft.brokerId || !draft.leaderId}
        onClick={() => void persist(draft, ++selectionRequest.current)}
      >
        ذخیره تنظیمات واچر
      </Button>
      {lookupError && (
        <p role="alert" className="text-destructive">
          {lookupError}
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
