'use client';

import { useState, type FormEvent } from 'react';
import type {
  IntegrationBrandConfigV1,
  IntegrationCapabilityConfigV1,
  IntegrationRegistryV1,
  IntegrationRegistryWriteV1,
  IntegrationSystemConfigV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form-controls';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { Card } from '@/components/ui/surfaces';
import { browserRandomUuid } from '@/lib/browser-random-uuid';
import { domainLabels, lifecycleLabels, registryConfig } from '../model';

export type CatalogueEdit =
  | { kind: 'brand'; record?: IntegrationBrandConfigV1 }
  | { kind: 'system'; record?: IntegrationSystemConfigV1; brandId?: string }
  | { kind: 'capability'; record?: IntegrationCapabilityConfigV1 };

export function CatalogueEditor({
  edit,
  registry,
  busy,
  onCancel,
  onSave,
}: {
  edit: CatalogueEdit;
  registry: IntegrationRegistryV1;
  busy: boolean;
  onCancel: () => void;
  onSave: (input: IntegrationRegistryWriteV1) => Promise<void>;
}) {
  const [capabilities, setCapabilities] = useState(
    edit.kind === 'system' ? (edit.record?.capabilityCodes ?? []) : [],
  );
  const [draftLifecycle, setDraftLifecycle] = useState(
    edit.record?.lifecycle ?? 'ENABLED',
  );
  const [draftBrand, setDraftBrand] = useState(
    edit.kind === 'system'
      ? (edit.record?.brandId ??
          edit.brandId ??
          registry.brands.find((brand) => brand.lifecycle === 'ENABLED')?.id ??
          '')
      : '',
  );
  const [draftDomain, setDraftDomain] = useState(
    edit.kind === 'system' ? (edit.record?.businessDomain ?? 'OTHER') : 'OTHER',
  );
  const title =
    edit.kind === 'brand'
      ? 'اطلاعات برند'
      : edit.kind === 'system'
        ? 'اطلاعات سامانه'
        : 'قابلیت قابل تنظیم';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const config = registryConfig(registry);
    const common = {
      code: String(form.get('code')),
      name: String(form.get('name')),
      lifecycle: String(
        form.get('lifecycle'),
      ) as IntegrationBrandConfigV1['lifecycle'],
    };
    if (edit.kind === 'brand') {
      const row = { ...common, id: edit.record?.id ?? browserRandomUuid() };
      config.brands = edit.record
        ? config.brands.map((item) => (item.id === row.id ? row : item))
        : [...config.brands, row];
    } else if (edit.kind === 'system') {
      const row: IntegrationSystemConfigV1 = {
        ...common,
        id: edit.record?.id ?? browserRandomUuid(),
        brandId: String(form.get('brandId')),
        kind: String(form.get('kind')),
        businessDomain: String(
          form.get('businessDomain'),
        ) as IntegrationSystemConfigV1['businessDomain'],
        capabilityCodes: capabilities,
      };
      config.systems = edit.record
        ? config.systems.map((item) => (item.id === row.id ? row : item))
        : [...config.systems, row];
    } else {
      config.capabilities = edit.record
        ? config.capabilities.map((item) =>
            item.code === common.code ? common : item,
          )
        : [...config.capabilities, common];
    }
    await onSave({
      ...config,
      expectedVersion: registry.version,
      reason: String(form.get('reason')),
    });
  }
  return (
    <Card className="p-5">
      <form
        aria-label={title}
        className="grid gap-5"
        onSubmit={(event) => void submit(event)}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold">{title}</h2>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={onCancel}
          >
            بستن فرم
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="integration-name" label="نام" required>
            <Input
              id="integration-name"
              name="name"
              required
              maxLength={120}
              defaultValue={edit.record?.name ?? ''}
              disabled={busy}
            />
          </FormField>
          <FormField
            id="integration-code"
            label="کد ثابت"
            description="حروف کوچک لاتین، عدد، نقطه یا خط تیره"
            required
          >
            <Input
              id="integration-code"
              dir="ltr"
              name="code"
              required
              pattern="[a-z][a-z0-9._\-]{1,63}"
              maxLength={64}
              readOnly={!!edit.record}
              defaultValue={edit.record?.code ?? ''}
              disabled={busy}
            />
          </FormField>
          <FormField id="integration-lifecycle" label="وضعیت فهرست">
            <NativeSearchSelect
              id="integration-lifecycle"
              name="lifecycle"
              aria-label="وضعیت فهرست"
              value={draftLifecycle}
              onChange={(event) =>
                setDraftLifecycle(
                  event.target.value as IntegrationBrandConfigV1['lifecycle'],
                )
              }
              disabled={busy}
            >
              {Object.entries(lifecycleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSearchSelect>
          </FormField>
          {edit.kind === 'system' ? (
            <>
              <FormField id="integration-brand" label="برند" required>
                <NativeSearchSelect
                  id="integration-brand"
                  name="brandId"
                  aria-label="برند"
                  value={draftBrand}
                  onChange={(event) => setDraftBrand(event.target.value)}
                  disabled={busy}
                >
                  {registry.brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </NativeSearchSelect>
              </FormField>
              <FormField id="integration-kind" label="نوع سامانه" required>
                <Input
                  id="integration-kind"
                  name="kind"
                  required
                  maxLength={120}
                  defaultValue={edit.record?.kind ?? ''}
                  placeholder="وب‌سایت، فروشگاه یا سامانه آموزشی"
                  disabled={busy}
                />
              </FormField>
              <FormField id="integration-domain" label="حوزه فعالیت">
                <NativeSearchSelect
                  id="integration-domain"
                  name="businessDomain"
                  aria-label="حوزه فعالیت"
                  value={draftDomain}
                  onChange={(event) =>
                    setDraftDomain(
                      event.target
                        .value as IntegrationSystemConfigV1['businessDomain'],
                    )
                  }
                  disabled={busy}
                >
                  {Object.entries(domainLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSearchSelect>
              </FormField>
            </>
          ) : null}
        </div>
        {edit.kind === 'system' ? (
          <fieldset
            disabled={busy}
            className="rounded-xl border border-border p-4"
          >
            <legend className="px-2 text-sm font-semibold">
              قابلیت‌های برنامه‌ریزی‌شده
            </legend>
            {registry.capabilities.length ? (
              <div className="flex flex-wrap gap-4">
                {registry.capabilities.map((capability) => (
                  <label
                    key={capability.code}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={capabilities.includes(capability.code)}
                      disabled={
                        capability.lifecycle !== 'ENABLED' &&
                        !capabilities.includes(capability.code)
                      }
                      onChange={(event) =>
                        setCapabilities(
                          event.target.checked
                            ? [...capabilities, capability.code]
                            : capabilities.filter(
                                (code) => code !== capability.code,
                              ),
                        )
                      }
                    />
                    {capability.name}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                قابلیت‌ها را از تنظیمات تعریف کنید.
              </p>
            )}
          </fieldset>
        ) : null}
        <FormField id="integration-reason" label="دلیل تغییر" required>
          <Input
            id="integration-reason"
            name="reason"
            required
            minLength={5}
            maxLength={120}
            disabled={busy}
          />
        </FormField>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? 'در حال ذخیره…' : 'ذخیره اطلاعات'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onCancel}
          >
            انصراف
          </Button>
        </div>
      </form>
    </Card>
  );
}
