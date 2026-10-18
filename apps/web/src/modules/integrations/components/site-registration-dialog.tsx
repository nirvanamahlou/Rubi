'use client';

import { useState, type FormEvent } from 'react';
import type {
  IntegrationRegistryV1,
  IntegrationRegistryWriteV1,
  IntegrationSystemConfigV1,
} from '@nora/contracts';
import { ArrowLeft, Check, Globe2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form-controls';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { Alert } from '@/components/ui/surfaces';
import { browserRandomUuid } from '@/lib/browser-random-uuid';
import { domainLabels } from '../model';
import {
  authenticationLabels,
  environmentLabels,
  newBrandValue,
  protocolLabels,
  siteDraft,
  siteRegistration,
  type SiteRegistrationDraft,
} from '../site-registration';

export function SiteRegistrationDialog({
  data,
  system,
  busy,
  error,
  onClose,
  onSave,
}: {
  data: IntegrationRegistryV1;
  system?: IntegrationSystemConfigV1;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (input: IntegrationRegistryWriteV1, id: string) => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(() => siteDraft(data, system));
  const [ids] = useState(() => ({
    system: system?.id ?? browserRandomUuid(),
    brand: browserRandomUuid(),
  }));
  const [localError, setLocalError] = useState('');
  function field<K extends keyof SiteRegistrationDraft>(
    key: K,
    value: SiteRegistrationDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setLocalError('');
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (step === 1) {
      setStep(2);
      return;
    }
    try {
      await onSave(siteRegistration(data, draft, ids, system), ids.system);
    } catch (caught) {
      setLocalError(
        caught instanceof Error ? caught.message : 'ثبت سایت کامل نشد.',
      );
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        dir="rtl"
        className="grid max-h-[90dvh] gap-4 overflow-y-auto sm:max-w-2xl"
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <div className="flex items-center gap-3 pe-8">
          <span className="rounded-xl bg-primary/10 p-3 text-primary">
            <Globe2 className="size-6" />
          </span>
          <DialogTitle>
            {system ? 'راه‌اندازی سایت یا سامانه' : 'افزودن سایت یا سامانه'}
          </DialogTitle>
        </div>
        <DialogDescription>
          مشخصات سایت را ثبت کنید و اطلاعات اتصال را اکنون یا در زمان دیگری
          تکمیل کنید.
        </DialogDescription>
        <ol
          aria-label="مراحل تعریف سایت"
          className="grid grid-cols-2 gap-3 text-sm"
        >
          {[
            ['۱', 'مشخصات سایت'],
            ['۲', 'آماده‌سازی اتصال'],
          ].map(([number, label], index) => (
            <li
              key={number}
              aria-current={step === index + 1 ? 'step' : undefined}
              className={`flex items-center gap-2 rounded-xl border p-3 ${step === index + 1 ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'}`}
            >
              <span className="font-bold">
                {step > index + 1 ? <Check className="size-4" /> : number}
              </span>
              {label}
            </li>
          ))}
        </ol>
        {error || localError ? (
          <Alert
            title="ثبت سایت کامل نشد"
            description={localError || error}
            tone="error"
          />
        ) : null}
        <form
          onSubmit={(event) => void submit(event)}
          className="grid gap-4"
          aria-label="تعریف سایت جدید"
        >
          <fieldset disabled={busy} className="grid gap-3">
            {step === 1 ? (
              <>
                <FormField
                  id="new-site-name"
                  label="نام سایت یا سامانه"
                  required
                >
                  <Input
                    id="new-site-name"
                    autoFocus
                    value={draft.name}
                    onChange={(e) => field('name', e.target.value)}
                    maxLength={120}
                    required
                    placeholder="نامی که روی کارت سامانه نمایش داده می‌شود"
                  />
                </FormField>
                <FormField id="new-site-brand" label="برند" required>
                  <NativeSearchSelect
                    id="new-site-brand"
                    aria-label="برند سایت"
                    value={draft.brandId}
                    onChange={(e) => field('brandId', e.target.value)}
                  >
                    {data.brands
                      .filter(
                        (row) =>
                          row.lifecycle === 'ENABLED' ||
                          row.id === system?.brandId,
                      )
                      .map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name}
                        </option>
                      ))}
                    <option value={newBrandValue}>ایجاد برند جدید</option>
                  </NativeSearchSelect>
                </FormField>
                {draft.brandId === newBrandValue ? (
                  <FormField
                    id="new-site-brand-name"
                    label="نام برند جدید"
                    required
                  >
                    <Input
                      id="new-site-brand-name"
                      value={draft.brandName}
                      onChange={(e) => field('brandName', e.target.value)}
                      maxLength={120}
                      required
                    />
                  </FormField>
                ) : null}
                <FormField
                  id="new-site-address"
                  label="نشانی سایت"
                  description="اختیاری؛ نشانی عمومی HTTPS بدون رمز یا توکن"
                >
                  <Input
                    id="new-site-address"
                    dir="ltr"
                    type="url"
                    value={draft.websiteUrl}
                    onChange={(e) => field('websiteUrl', e.target.value)}
                    maxLength={512}
                    placeholder="https://www.example.com"
                  />
                </FormField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="new-site-domain" label="حوزه فعالیت">
                    <NativeSearchSelect
                      id="new-site-domain"
                      value={draft.businessDomain}
                      onChange={(e) =>
                        field(
                          'businessDomain',
                          e.target
                            .value as SiteRegistrationDraft['businessDomain'],
                        )
                      }
                    >
                      {Object.entries(domainLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </NativeSearchSelect>
                  </FormField>
                  <FormField id="new-site-kind" label="نوع سامانه" required>
                    <Input
                      id="new-site-kind"
                      value={draft.kind}
                      onChange={(e) => field('kind', e.target.value)}
                      maxLength={120}
                      required
                    />
                  </FormField>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-xl bg-muted/50 p-3 text-sm">
                  <strong>{draft.name}</strong>
                  <p className="mt-1 text-muted-foreground">
                    {draft.brandId === newBrandValue
                      ? draft.brandName
                      : data.brands.find((row) => row.id === draft.brandId)
                          ?.name}
                  </p>
                  {draft.websiteUrl ? (
                    <bdi className="mt-2 block break-all">
                      {draft.websiteUrl}
                    </bdi>
                  ) : null}
                </div>
                <p className="text-sm leading-7 text-muted-foreground">
                  این بخش اختیاری است. روش اتصال را مشخص کنید؛ دریافت دسترسی و
                  تأیید ارتباط در مرحلهٔ راه‌اندازی انجام می‌شود.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="new-site-protocol" label="روش ارتباط">
                    <NativeSearchSelect
                      id="new-site-protocol"
                      value={draft.protocol}
                      onChange={(e) =>
                        field(
                          'protocol',
                          e.target.value as SiteRegistrationDraft['protocol'],
                        )
                      }
                    >
                      {Object.entries(protocolLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </NativeSearchSelect>
                  </FormField>
                  <FormField id="new-site-environment" label="محیط اتصال">
                    <NativeSearchSelect
                      id="new-site-environment"
                      value={draft.environment}
                      onChange={(e) =>
                        field(
                          'environment',
                          e.target
                            .value as SiteRegistrationDraft['environment'],
                        )
                      }
                    >
                      {Object.entries(environmentLabels).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </NativeSearchSelect>
                  </FormField>
                </div>
                <FormField id="new-site-api" label="نشانی پایه API">
                  <Input
                    id="new-site-api"
                    dir="ltr"
                    type="url"
                    value={draft.apiBaseUrl}
                    onChange={(e) => field('apiBaseUrl', e.target.value)}
                    maxLength={512}
                    placeholder="https://api.example.com/v1"
                  />
                </FormField>
                <FormField id="new-site-docs" label="مستندات اتصال">
                  <Input
                    id="new-site-docs"
                    dir="ltr"
                    type="url"
                    value={draft.documentationUrl}
                    onChange={(e) => field('documentationUrl', e.target.value)}
                    maxLength={512}
                    placeholder="https://docs.example.com"
                  />
                </FormField>
                <FormField id="new-site-auth" label="روش احراز هویت">
                  <NativeSearchSelect
                    id="new-site-auth"
                    value={draft.authentication}
                    onChange={(e) =>
                      field(
                        'authentication',
                        e.target
                          .value as SiteRegistrationDraft['authentication'],
                      )
                    }
                  >
                    {Object.entries(authenticationLabels).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </NativeSearchSelect>
                </FormField>
                {data.capabilities.length ? (
                  <fieldset className="rounded-xl border border-border p-3">
                    <legend className="px-2 text-sm">
                      قابلیت‌های مورد نیاز
                    </legend>
                    <div className="flex flex-wrap gap-4">
                      {data.capabilities
                        .filter(
                          (row) =>
                            row.lifecycle === 'ENABLED' ||
                            draft.capabilityCodes.includes(row.code),
                        )
                        .map((row) => (
                          <label
                            key={row.code}
                            className="flex items-center gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={draft.capabilityCodes.includes(row.code)}
                              onChange={(e) =>
                                field(
                                  'capabilityCodes',
                                  e.target.checked
                                    ? [...draft.capabilityCodes, row.code]
                                    : draft.capabilityCodes.filter(
                                        (code) => code !== row.code,
                                      ),
                                )
                              }
                            />
                            {row.name}
                          </label>
                        ))}
                    </div>
                  </fieldset>
                ) : null}
                <p className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-7">
                  پس از ثبت، سایت با وضعیت «آماده اتصال» به فهرست اضافه می‌شود.
                  رمز، کلید و توکن را در نشانی‌ها وارد نکنید.
                </p>
              </>
            )}
          </fieldset>
          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => (step === 2 ? setStep(1) : onClose())}
            >
              {step === 2 ? 'مرحله قبل' : 'انصراف'}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy
                ? 'در حال ذخیره…'
                : step === 1
                  ? 'ادامه تنظیمات'
                  : system
                    ? 'ذخیره مشخصات سایت'
                    : 'ثبت سایت'}
              {step === 1 ? <ArrowLeft className="size-4" /> : null}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
