export function ReportPrerequisites({
  readiness,
  error,
  onRetry,
}: {
  readiness: { reason: string; requirements: readonly string[] } | null;
  error: boolean;
  onRetry: () => void;
}) {
  return (
    <div
      className="mt-5 rounded-2xl border border-border bg-background p-5"
      role="status"
      dir="rtl"
    >
      <h3 className="font-semibold">پیش‌نیازهای فعال‌سازی گزارش</h3>
      <p className="mt-3 text-sm leading-7">
        {readiness?.reason ??
          (error
            ? 'دریافت وضعیت منبع گزارش ممکن نشد؛ دوباره تلاش کنید.'
            : 'در حال بررسی پیش‌نیازهای گزارش…')}
      </p>
      {readiness && (
        <ul className="mt-3 list-inside list-disc space-y-2 text-sm">
          {readiness.requirements.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {error && (
        <button
          className="mt-3 rounded-xl border border-border px-3 py-2 text-sm"
          type="button"
          onClick={onRetry}
        >
          تلاش دوباره
        </button>
      )}
    </div>
  );
}
