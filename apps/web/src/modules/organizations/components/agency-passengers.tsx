'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { agencyClient } from '../api/agency-client';
const fields = [
  ['birthDate', 'تاریخ تولد (میلادی)'],
  ['nationalId', 'کد ملی'],
  ['passportNumber', 'شماره گذرنامه'],
  ['passportExpiryDate', 'تاریخ انقضای گذرنامه (میلادی)'],
  ['gender', 'جنسیت (M / F)'],
  ['nationalityCode', 'کد ملیت'],
  ['passportIssuingCountryCode', 'کد کشور صادرکننده'],
  ['birthCountryCode', 'کد کشور محل تولد'],
] as const;
export function AgencyPassengers() {
  const [contracts, setContracts] = useState<
    Awaited<ReturnType<typeof agencyClient.portalPassengers>>['data']
  >([]);
  const [canEdit, setCanEdit] = useState(false);
  const [selected, setSelected] = useState<{
    contractId: string;
    passengerId: string;
  }>();
  const [detail, setDetail] =
    useState<Record<string, string | number | null>>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    agencyClient
      .portalPassengers()
      .then((r) => {
        if (active) {
          setContracts(r.data);
          setCanEdit(r.canEdit);
        }
      })
      .catch((e: unknown) => {
        if (active)
          setError(
            e instanceof Error ? e.message : 'دریافت مسافران انجام نشد.',
          );
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    if (selected)
      agencyClient
        .portalPassenger(selected.contractId, selected.passengerId)
        .then((r) => {
          if (active) setDetail(r.data);
        })
        .catch((e: unknown) => {
          if (active)
            setError(
              e instanceof Error ? e.message : 'دریافت مشخصات انجام نشد.',
            );
        });
    return () => {
      active = false;
    };
  }, [selected]);
  async function save() {
    if (!selected || !detail || busy) return;
    setBusy(true);
    setError('');
    try {
      const input = {
        version: detail.version!,
        ...Object.fromEntries(
          fields.map(([key]) => [key, detail[key] ?? null]),
        ),
      };
      const result = await agencyClient.updatePortalPassenger(
        selected.contractId,
        selected.passengerId,
        input,
      );
      setDetail(result.data);
      setError('جزئیات مسافر ذخیره شد.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیره انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel p-5 space-y-4">
      <h2 className="font-bold">مسافران قراردادهای آژانس</h2>
      <p>
        نام و نام خانوادگی فارسی و لاتین ثابت هستند. ویرایش جزئیات هویتی، قیمت و
        تخصیص خدمات قرارداد را تغییر نمی‌دهد.
      </p>
      {error && <p role="status">{error}</p>}
      {contracts.map((c) => (
        <article key={c.id}>
          <h3>{c.contractNumber}</h3>
          <div className="flex gap-2 flex-wrap">
            {c.passengers.map((p) => (
              <Button
                type="button"
                variant="outline"
                key={p.customerId}
                onClick={() => {
                  setDetail(undefined);
                  setSelected({ contractId: c.id, passengerId: p.customerId });
                }}
              >
                {p.displayNameSnapshot}
              </Button>
            ))}
          </div>
        </article>
      ))}
      {detail && (
        <fieldset
          disabled={!canEdit || busy}
          className="grid gap-3 md:grid-cols-2"
        >
          {(
            [
              'firstName',
              'lastName',
              'passportFirstName',
              'passportLastName',
            ] as const
          ).map((key, i) => (
            <label key={key}>
              {['نام', 'نام خانوادگی', 'نام لاتین', 'نام خانوادگی لاتین'][i]}
              <Input value={String(detail[key] ?? '')} disabled />
            </label>
          ))}
          {fields.map(([key, label]) => (
            <label key={key}>
              {label}
              <Input
                value={String(detail[key] ?? '')}
                onChange={(e) =>
                  setDetail({ ...detail, [key]: e.target.value || null })
                }
              />
            </label>
          ))}
          <Button type="button" onClick={() => void save()}>
            ذخیره جزئیات مسافر
          </Button>
        </fieldset>
      )}
    </section>
  );
}
