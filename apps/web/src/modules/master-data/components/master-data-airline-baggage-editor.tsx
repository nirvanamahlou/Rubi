'use client';

import type { MasterDataRecord } from '@nora/contracts';
import { useCallback, useEffect, useState } from 'react';
import { Luggage, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';
import { Alert, Badge, Card } from '@/components/ui/surfaces';
import { masterDataApi } from '../api/client';
import { validateMasterDataDraft } from '../model/validation';
import { MasterDataNumberInput } from './master-data-number-input';
import { MasterDataPowerButton } from './master-data-power-button';

const passengerTypes = [
  { value: 'ADT', label: 'بزرگسال' },
  { value: 'CHD', label: 'کودک' },
  { value: 'INF', label: 'نوزاد' },
] as const;
const routeScopes = [
  { value: 'ALL', label: 'همه مسیرها' },
  { value: 'DOMESTIC', label: 'داخلی' },
  { value: 'INTERNATIONAL', label: 'بین‌المللی' },
] as const;

function ruleValues(record?: MasterDataRecord): Record<string, string> {
  return {
    passengerType: String(record?.attributes.passengerType ?? 'ADT'),
    cabinClassId: String(record?.attributes.cabinClassId ?? ''),
    routeScope: String(record?.attributes.routeScope ?? 'ALL'),
    allowance: String(record?.attributes.allowance ?? ''),
    unit: String(record?.attributes.unit ?? 'KG'),
    pieceCount: String(record?.attributes.pieceCount ?? ''),
    description: String(record?.attributes.description ?? ''),
  };
}

function ruleLabel(record: MasterDataRecord) {
  const passenger = passengerTypes.find(
    (type) => type.value === record.attributes.passengerType,
  )?.label ?? String(record.attributes.passengerType);
  const route = routeScopes.find(
    (scope) => scope.value === record.attributes.routeScope,
  )?.label ?? String(record.attributes.routeScope);
  return `${passenger} · ${String(record.attributes.cabinClassName || 'همه کلاس‌ها')} · ${route}`;
}

export function MasterDataAirlineBaggageEditor({
  airline,
  disabled = false,
  readOnly = false,
}: {
  airline?: MasterDataRecord;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  const [rules, setRules] = useState<readonly MasterDataRecord[]>([]);
  const [classes, setClasses] = useState<readonly MasterDataRecord[]>([]);
  const [editing, setEditing] = useState<MasterDataRecord>();
  const [draft, setDraft] = useState<Record<string, string>>(() => ruleValues());
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(Boolean(airline));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!airline) return;
    setLoading(true);
    try {
      const result: MasterDataRecord[] = [];
      for (let page = 1; ; page += 1) {
        const response = await masterDataApi.list('baggage-rules', {
          columnFilter1: airline.name,
          search: '',
          status: 'all',
          sortBy: 'name',
          sortDirection: 'asc',
          page,
          pageSize: 100,
        });
        result.push(...response.data.filter((rule) => rule.attributes.airlineId === airline.id));
        if (page * 100 >= response.meta.total) break;
      }
      setRules(result);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'دریافت قواعد بار ناموفق بود.');
    } finally {
      setLoading(false);
    }
  }, [airline]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (!airline || readOnly) return;
    let active = true;
    void masterDataApi.list('cabin-classes', {
      search: '', status: 'active', sortBy: 'name', sortDirection: 'asc', page: 1, pageSize: 100,
    }).then((response) => {
      if (active) setClasses(response.data);
    }).catch(() => {
      if (active) setError('دریافت کلاس‌های پروازی ناموفق بود.');
    });
    return () => { active = false; };
  }, [airline, readOnly]);

  function change(key: string, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: '' }));
  }

  function start(record?: MasterDataRecord) {
    setEditing(record);
    setDraft(ruleValues(record));
    setFieldErrors({});
    setError(undefined);
    setExpanded(true);
  }

  async function save() {
    if (!airline) return;
    const cabin = classes.find((item) => item.id === draft.cabinClassId);
    const values: Record<string, string> = {
      ...draft,
      airlineId: airline.id,
      name: `Baggage ${airline.code} / ${draft.passengerType ?? 'ADT'} / ${String(cabin?.attributes.bookingCode ?? 'ALL')} / ${draft.routeScope ?? 'ALL'}`,
    };
    const result = validateMasterDataDraft('baggage-rules', values);
    setFieldErrors(result.errors);
    if (!result.success) return;
    const collision = rules.find((rule) =>
      rule.id !== editing?.id && rule.status === 'active' &&
      rule.attributes.passengerType === values.passengerType &&
      String(rule.attributes.cabinClassId ?? '') === values.cabinClassId &&
      rule.attributes.routeScope === values.routeScope,
    );
    if (collision) {
      setError('برای این نوع مسافر، کلاس و دامنه مسیر قاعده فعال دیگری وجود دارد؛ آن را ویرایش یا غیرفعال کنید.');
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      if (editing) {
        await masterDataApi.update('baggage-rules', editing.id, {
          values: result.values, version: editing.version,
        });
      } else {
        await masterDataApi.create('baggage-rules', { values: result.values });
      }
      setExpanded(false);
      setEditing(undefined);
      setDraft(ruleValues());
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ذخیره قاعده بار ناموفق بود.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-4 p-4" aria-label="قواعد بار ایرلاین">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold"><Luggage className="size-4" /> قواعد بار ایرلاین</h3>
        {airline && !readOnly ? (
          <Button type="button" size="sm" variant="outline" disabled={disabled || saving} onClick={() => start()}>
            <Plus className="size-4" /> افزودن قاعده
          </Button>
        ) : null}
      </div>
      {!airline ? (
        <p className="text-sm text-muted-foreground">ابتدا ایرلاین را ذخیره کنید؛ همین فرم برای افزودن قواعد بار بزرگسال، کودک و نوزاد و کلاس‌های پروازی باز می‌ماند.</p>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">در حال دریافت قواعد بار…</p>
      ) : rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">هنوز قاعده‌ای برای این ایرلاین ثبت نشده است.</p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div key={rule.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
              <span>{ruleLabel(rule)} · {String(rule.attributes.allowance)} {rule.attributes.unit === 'KG' ? 'کیلوگرم' : 'قطعه'}</span>
              <div className="flex items-center gap-2">
                <Badge>{rule.status === 'active' ? 'فعال' : 'غیرفعال'}</Badge>
                {!readOnly ? (
                  <>
                    <Button type="button" variant="outline" size="sm" disabled={disabled || saving} onClick={() => start(rule)}>ویرایش</Button>
                    <MasterDataPowerButton record={rule} onChanged={load} />
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
      {error ? <Alert title="قواعد بار" description={error} tone="error" /> : null}
      {expanded && !readOnly && airline ? (
        <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-2">
          <FormField label="نوع مسافر" required {...(fieldErrors.passengerType ? { error: fieldErrors.passengerType } : {})}>
            <Select value={draft.passengerType ?? 'ADT'} onValueChange={(value) => change('passengerType', value)} disabled={saving}>
              <SelectTrigger aria-label="نوع مسافر قاعده بار"><SelectValue /></SelectTrigger>
              <SelectContent>{passengerTypes.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField label="کلاس پروازی" {...(fieldErrors.cabinClassId ? { error: fieldErrors.cabinClassId } : {})}>
            <Select value={draft.cabinClassId || '__all__'} onValueChange={(value) => change('cabinClassId', value === '__all__' ? '' : value)} disabled={saving}>
              <SelectTrigger aria-label="کلاس پروازی قاعده بار"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">همه کلاس‌ها (قاعده عمومی)</SelectItem>
                {classes.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.attributes.bookingCode ? String(item.attributes.bookingCode) : item.code}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="دامنه مسیر" required {...(fieldErrors.routeScope ? { error: fieldErrors.routeScope } : {})}>
            <Select value={draft.routeScope ?? 'ALL'} onValueChange={(value) => change('routeScope', value)} disabled={saving}>
              <SelectTrigger aria-label="دامنه مسیر قاعده بار"><SelectValue /></SelectTrigger>
              <SelectContent>{routeScopes.map((scope) => <SelectItem key={scope.value} value={scope.value}>{scope.label}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <FormField label="واحد" required {...(fieldErrors.unit ? { error: fieldErrors.unit } : {})}>
            <Select value={draft.unit ?? 'KG'} onValueChange={(value) => change('unit', value)} disabled={saving}>
              <SelectTrigger aria-label="واحد قاعده بار"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="KG">کیلوگرم</SelectItem><SelectItem value="PC">قطعه</SelectItem></SelectContent>
            </Select>
          </FormField>
          <FormField label="مقدار مجاز" required {...(fieldErrors.allowance ? { error: fieldErrors.allowance } : {})}>
            <MasterDataNumberInput value={draft.allowance ?? ''} onChange={(value) => change('allowance', value)} disabled={saving} placeholder="20" />
          </FormField>
          <FormField label="تعداد قطعه" required={draft.unit === 'PC'} {...(fieldErrors.pieceCount ? { error: fieldErrors.pieceCount } : {})}>
            <MasterDataNumberInput value={draft.pieceCount ?? ''} onChange={(value) => change('pieceCount', value)} disabled={saving} placeholder="1" />
          </FormField>
          <FormField label="توضیحات" {...(fieldErrors.description ? { error: fieldErrors.description } : {})}>
            <Input value={draft.description ?? ''} onChange={(event) => change('description', event.target.value)} disabled={saving} maxLength={500} />
          </FormField>
          <div className="flex items-end gap-2">
            <Button type="button" loading={saving} onClick={() => void save()}>ذخیره قاعده</Button>
            <Button type="button" variant="ghost" disabled={saving} onClick={() => setExpanded(false)}>انصراف</Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
