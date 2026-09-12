'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form-controls';
import { CustomerAffairsFormDialog } from './customer-affairs-form-dialog';
import { customerAffairsApi } from '../api/customer-affairs-client';

export function LeadCustomerConversion({
  id,
  version,
  onReload,
}: {
  id: string;
  version: number;
  onReload: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setError('');
          setOpen(true);
        }}
      >
        تبدیل به مشتری
      </Button>
      {open && (
        <CustomerAffairsFormDialog
          title="ایجاد مشتری از سرنخ"
          description="اگر مشتری قبلاً ثبت شده، از ویرایش اطلاعات پرونده و انتخاب مشتری موجود استفاده کنید. این عملیات به مجوز ایجاد مشتری نیاز دارد."
          busy={busy}
          onClose={() => setOpen(false)}
        >
          <form
            className="grid gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              setBusy(true);
              setError('');
              try {
                await customerAffairsApi.convertCustomer(id, {
                  firstName: String(data.get('firstName') || ''),
                  lastName: String(data.get('lastName') || ''),
                  nationalId: String(data.get('nationalId') || '').replace(
                    /[۰-۹]/g,
                    (digit) => String(digit.charCodeAt(0) - 1776),
                  ),
                  expectedVersion: version,
                });
                await onReload();
                setOpen(false);
              } catch (cause) {
                setError(
                  cause instanceof Error ? cause.message : 'مشتری ایجاد نشد.',
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <FormField id="conversion-first-name" label="نام">
              <Input
                id="conversion-first-name"
                name="firstName"
                required
                maxLength={100}
                autoComplete="given-name"
              />
            </FormField>
            <FormField id="conversion-last-name" label="نام خانوادگی">
              <Input
                id="conversion-last-name"
                name="lastName"
                required
                maxLength={100}
                autoComplete="family-name"
              />
            </FormField>
            <FormField id="conversion-national-id" label="کد ملی">
              <Input
                id="conversion-national-id"
                name="nationalId"
                required
                inputMode="numeric"
                minLength={10}
                maxLength={10}
                autoComplete="off"
              />
            </FormField>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              ایجاد و اتصال مشتری
            </Button>
          </form>
        </CustomerAffairsFormDialog>
      )}
    </>
  );
}
