# TICKET-TIME-REPEAT-0920 — بازگشت زمان حرکت و رسیدن بلیت

- Computer: `PC-A`
- Status: `READY_FOR_REVIEW`
- Branch: `codex/pc-a-ticket-time-repeat-0920`
- Base: `origin/develop@7e52d309b1fee7fbe39972b4bdf7aee0ad6c31b9`

## دامنه

فقط فرم و تست‌های Web ماژول Ticket Catalog تغییر کرده‌اند. Schema/Migration، قرارداد عمومی، API، Permission، Dependency/Lockfile، دادهٔ عملیاتی و runtime محلی تغییر نکرده‌اند.

## رفتار

- «تاریخ و ساعت حرکت» و «تاریخ و ساعت رسیدن» برای بلیت یک‌طرفه، برگشت و تک‌تک قطعه‌های بلیت ترکیبی در دسترس‌اند.
- زمان به‌صورت local wall time در منطقهٔ زمانی همان مسیر گرفته و به UTC ذخیره می‌شود؛ منطقهٔ زمانی یا offset فنی در فرم نمایش داده نمی‌شود.
- انتخاب تاریخ/ساعت حرکت، `serviceDate` (تاریخ اولین بلیت) را همگام می‌کند. بنابراین تکرار هفتگی یا ماهانه تاریخ را جابه‌جا و ساعت حرکت/رسیدن را حفظ می‌کند.
- بلیت‌های قبلیِ بدون ساعت همچنان معتبرند و تکرار آن‌ها با `serviceDate` کار می‌کند. زمان‌ها اختیاری‌اند، اما اگر فقط یکی از حرکت/رسیدن ثبت شود، اعتبارسنجی موجود آن را رد می‌کند.

## اعتبارسنجی

- `pnpm --filter @nora/contracts build`
- `pnpm --filter @nora/web exec vitest run --config src/modules/ticket-catalog/vitest.config.mts src/modules/ticket-catalog` — ۱۰ فایل / ۱۰۰ تست موفق.
- `pnpm --filter @nora/web lint` — موفق.
- `pnpm --filter @nora/web typecheck` — موفق.
- build تولیدی Web در Worktree جدا اجرا و خروجی `apps/web/.next/BUILD_ID` تولید شد؛ هیچ runtime و پورت ۳۱۰۰ تغییر نکرد.

## تحویل

این تغییر به PR مستقل برای `develop` نیاز دارد. Merge یا اجرای `localhost:3100` در این Worktree انجام نشده است.