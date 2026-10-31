'use client';
import { isOptionalOperationReason } from '@nora/contracts';

import { useEffect, useRef, useState } from 'react';
import type {
  CustomerSummary,
  SalesContractDetail,
  SalesBuyerContactV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/form-controls';
import { salesApi } from '@/modules/sales/api/client';
import { salesPeopleApi as customersApi } from '@/modules/customers/api/client';
import { SalesOrganizationCustomer } from '@/modules/sales/components/sales-organization-customer';
import { SalesPersonCreate } from '@/modules/sales/components/sales-person-create';
import { SalesPersonSearch } from '@/modules/sales/components/sales-person-search';

export function ReservationPartyEditor({
  contract,
  onSaved,
}: {
  contract: SalesContractDetail;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<'person' | 'organization'>('person');
  const [customerId, setCustomerId] = useState(contract.customerId);
  const [name, setName] = useState(contract.customerNameSnapshot);
  const [organizationId, setOrganizationId] = useState('');
  const [contact, setContact] = useState<SalesBuyerContactV1>(
    contract.buyerContact ?? {
      name: contract.customerNameSnapshot,
      phone: '',
      address: '',
      postalCode: '',
    },
  );
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState(false);
  const [create, setCreate] = useState(false);
  const choices = useRef<
    Partial<
      Record<
        'person' | 'organization',
        {
          customerId: string;
          name: string;
          organizationId: string;
          contact: SalesBuyerContactV1;
        }
      >
    >
  >({});
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [directoryBusy, setDirectoryBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    customersApi
      .detail(contract.customerId)
      .then(({ data }) => {
        if (!live) return;
        setKind(data.kind);
        setOrganizationId(data.organizationId ?? '');
        setReady(true);
      })
      .catch((e) => {
        if (live)
          setError(
            e instanceof Error
              ? e.message
              : 'دریافت اطلاعات طرف قرارداد انجام نشد.',
          );
      });
    return () => {
      live = false;
    };
  }, [contract.customerId]);
  function select(person: CustomerSummary) {
    setKind(person.kind);
    setCustomerId(person.id);
    setName(person.displayName);
    setOrganizationId(person.organizationId ?? '');
    setContact({
      phone: '',
      address: '',
      postalCode: '',
      ...(create ||
      customerId === person.id ||
      (!customerId && kind === 'person')
        ? contact
        : person.id === contract.customerId
          ? contract.buyerContact
          : {}),
      name: person.displayName,
    });
    setSearch(false);
    setCreate(false);
  }
  async function save() {
    if (busy || directoryBusy || !ready || !isOptionalOperationReason(reason))
      return;
    if (!customerId) {
      setError('طرف قرارداد را انتخاب کنید.');
      setSearch(kind === 'person');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await salesApi.correctParty(contract.id, {
        version: contract.version,
        reason: (reason ?? '').trim(),
        customerId,
        buyerContact: kind === 'person' ? contact : null,
        transferFinancialHistory: true,
      });
      window.dispatchEvent(new Event('reservation-workflow-changed'));
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیره انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {!ready && !error && (
        <p role="status">در حال دریافت اطلاعات طرف قرارداد…</p>
      )}
      <fieldset
        disabled={!ready || busy || directoryBusy}
        className="grid gap-4"
      >
        <div className="flex gap-4">
          {(['person', 'organization'] as const).map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="contract-party-kind"
                checked={kind === value}
                onChange={() => {
                  choices.current[kind] = {
                    customerId,
                    name,
                    organizationId,
                    contact,
                  };
                  const saved = choices.current[value];
                  setKind(value);
                  setCustomerId(saved?.customerId ?? '');
                  setName(saved?.name ?? '');
                  setOrganizationId(saved?.organizationId ?? '');
                  setSearch(value === 'person' && !saved?.customerId);
                  setCreate(false);
                  setError('');
                  setContact(
                    saved?.contact ?? {
                      name: '',
                      phone: '',
                      address: '',
                      postalCode: '',
                    },
                  );
                }}
              />{' '}
              {value === 'person' ? 'مشتری' : 'آژانس'}
            </label>
          ))}
        </div>
        <p>{name || 'طرف قرارداد را انتخاب کنید.'}</p>
        {kind === 'organization' ? (
          <SalesOrganizationCustomer
            key={organizationId || 'agency'}
            selectedOrganizationId={organizationId}
            onSelected={select}
            onBusyChange={setDirectoryBusy}
            disabled={busy}
            onClear={() => {
              setCustomerId('');
              setName('');
            }}
          />
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSearch((v) => !v)}
            >
              انتخاب مشتری دیگر
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreate((v) => !v);
                setSearch(false);
              }}
            >
              افزودن مشتری جدید
            </Button>
            {create && (
              <SalesPersonCreate
                mode="customer"
                onCreated={select}
                onCancel={() => setCreate(false)}
                onBusyChange={setDirectoryBusy}
              />
            )}
            {search && (
              <SalesPersonSearch
                query={contact.name}
                purpose="customer"
                selectedIds={[]}
                onSelect={select}
                onCancel={() => setSearch(false)}
              />
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['name', 'نام مشتری'],
                  ['phone', 'شماره مشتری'],
                  ['address', 'آدرس مشتری'],
                  ['postalCode', 'کد پستی مشتری'],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <Input
                    aria-label={label}
                    required={key !== 'postalCode'}
                    value={contact[key]}
                    maxLength={
                      key === 'address'
                        ? 1000
                        : key === 'name'
                          ? 200
                          : key === 'phone'
                            ? 16
                            : 10
                    }
                    onChange={(e) => {
                      setContact((v) => ({ ...v, [key]: e.target.value }));
                      if (key === 'name' && !customerId && !create)
                        setSearch(true);
                    }}
                  />
                </label>
              ))}
            </div>
          </>
        )}
        <label>
          دلیل اصلاح
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}

            maxLength={500}
          />
        </label>
        <p className="text-sm text-muted-foreground">
          با ثبت، بدهی و دریافت‌های این قرارداد به طرف حساب انتخاب‌شده منتقل
          می‌شوند؛ سابقهٔ دریافت‌ها حفظ می‌شود.
        </p>
        <Button type="submit" disabled={!isOptionalOperationReason(reason)}>
          {busy ? 'در حال ذخیره…' : 'ثبت اصلاح طرف قرارداد'}
        </Button>
      </fieldset>
    </form>
  );
}
