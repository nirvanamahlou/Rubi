# LOCAL-UNIFIED-RUNTIME — PC-C

## هدف

پورت `3000` باید همیشه از Worktree یکپارچهٔ
`codex/pc-c-dashboard-reporting-latest` سرو شود. این Worktree آخرین نسخهٔ
Dashboard و Reports را در یک درخت منبع نگه می‌دارد و از بازگشت یک ماژول به
نسخهٔ قدیمی هنگام تغییر ماژول دیگر جلوگیری می‌کند.

## قرارداد اجرا

- پیش از تغییر Dashboard یا Reports، تغییر باید در همین Worktree انجام شود یا
  به همین شاخه منتقل شود؛ اجرای Next از `.worktrees/reporting`،
  `.worktrees/final-local-20260913` یا Worktree قدیمی مجاز نیست.
- سرور Web با `pnpm dev:local-unified` از `apps/web` همین Worktree روی پورت
  `3000` اجرا می‌شود و Next hot reload تغییرات هر دو ماژول را اعمال می‌کند.
- اگر پورت اشغال باشد، Launcher متوقف می‌شود تا نسخهٔ دیگری به‌صورت مخفی روی
  LocalHost باقی نماند. پس از بررسی PID می‌توان از `-Restart` استفاده کرد.
- پس از تعویض شاخه یا ادغام بزرگ، اجرای اختیاری
  `pnpm dev:local-unified -- -CleanNextCache -Restart` کش تولیدی را خارج از
  پروژه آرشیو و نسخهٔ تازه را build می‌کند.

## وضعیت فعال

در تاریخ 2026-09-14، LocalHost:3000 از همین Worktree و commit پایهٔ
`879b84fb` اجرا می‌شود. تغییرات محلی تکمیلی Dashboard/Reports نیز در همین
درخت نگه‌داری می‌شوند؛ دادهٔ نمونه یا Secret به این قرارداد اضافه نمی‌شود.
