# RESERVATION-MANIFEST-ROUTE-FILTERS-0929 — PC-A

- درخواست: افزودن فیلتر مبدا و مقصد به منیفست رزرواسیون در کنار فیلترهای تاریخ.
- محدوده: Reservations Web، گزینه‌های route از بلیط‌های بازه تاریخ، فیلتر ترکیبی کارت‌ها و تست‌ها.
- بازه تاریخ همچنان توسط API اعمال می‌شود. انتخاب route فقط کارت‌های موجود را فیلتر می‌کند و دانلود همان offer بدون تغییر است.
- بدون API، Migration، قرارداد مشترک، دسترسی یا داده عملیاتی و Dependency.
- اعتبارسنجی: سه تست helper و component، Web typecheck، ESLint هدفمند و production build (۵۵ مسیر) موفق‌اند. Migration یا Dependency وجود ندارد.
- وضعیت: آماده review در PR به `develop`؛ ادغام پس از CI و مجوز مالک.
