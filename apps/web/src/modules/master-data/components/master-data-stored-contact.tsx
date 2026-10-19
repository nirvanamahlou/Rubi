import { Button } from '@/components/ui/button';

/** Saved masked data is informational, never an editable replacement value. */
export function MasterDataStoredContact({
  label,
  masked,
  touched,
  value,
  disabled,
  onClear,
}: {
  label: string;
  masked: string;
  touched: boolean;
  value: string;
  disabled: boolean;
  onClear: () => void;
}) {
  if (!masked) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>
        {label} ثبت‌شده: <bdi dir="ltr">{masked}</bdi>
      </span>
      {touched ? (
        <span>
          {value
            ? 'مقدار جدید پس از ذخیره جایگزین می‌شود.'
            : 'مقدار ثبت‌شده پس از ذخیره پاک می‌شود.'}
        </span>
      ) : (
        <>
          <span>بدون تغییر باقی می‌ماند.</span>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={onClear}
          >
            پاک‌کردن {label} ثبت‌شده
          </Button>
        </>
      )}
    </div>
  );
}
