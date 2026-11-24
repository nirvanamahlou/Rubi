# راهنمای قیمت خرید هتل

<!-- nora-catalogue {"version":1,"path":"رزرواسیون ← قیمت خرید هتل"} -->

<a id="hotel-purchase-start"></a>

## انتخاب بخش در «قیمت خرید هتل»

<!-- nora-guide {"id":"hotel-purchase-start","href":"/reservations/hotel-rates","related":["reservations/hotel-rates"],"route":["رزرواسیون","قیمت خرید هتل","انتخاب بخش در «قیمت خرید هتل»"],"terms":["قیمت خرید هتل","پنل نرخ هتل","ورود به نرخ هتل"],"examples":["راهنمای پنل قیمت خرید هتل چیه؟"],"source":"apps/web/src/modules/reservations/hotel-rates/hotel-rate-hub.tsx"} -->

### مراحل

1. از کارت «بستهٔ جدید» ثبت دستی را شروع کنید. برای فایل، «ورودی اکسل نرخ‌ها» و برای مشاهده یا اصلاح نرخ ذخیره‌شده، «بسته‌های موجود» را بزنید.
2. «بازگشت به نرخ هتل» شما را به کارت‌ها برمی‌گرداند. پیش از تأیید خروج، تغییرات ذخیره‌نشده را بررسی کنید.

### راهنماهای مرتبط

- [راهنمای رزرواسیون](reservations.md#hotel-rates)

<a id="hotel-purchase-manual"></a>

## بستهٔ جدید

<!-- nora-guide {"id":"hotel-purchase-manual","href":"/reservations/hotel-rates","related":["hotel-purchase-rates/hotel-purchase-start"],"route":["رزرواسیون","قیمت خرید هتل","بستهٔ جدید"],"terms":["بسته جدید","ثبت دستی","چند هتل","ثبت بسته نرخ"],"examples":["چطور بستهٔ جدید چند هتل بسازم؟"],"source":"apps/web/src/modules/reservations/hotel-rates/packs-workspace.tsx"} -->

### مراحل

1. «بستهٔ جدید» را باز کنید. کشور و شهر، بازهٔ معتبر اقامت و هتل‌های بسته را مشخص کنید.
2. برای هر هتل منتخب، کارگزار و ارز، نوع اتاق، قیمت، ظرفیت و دست‌کم یک ضریب چیدمان معتبر را کنترل کنید. «ثبت بستهٔ نرخ» را بزنید و نتیجه را در «بسته‌های موجود» بررسی کنید.

### راهنماهای مرتبط

- [انتخاب بخش](#hotel-purchase-start)

<a id="hotel-purchase-references"></a>

## مراجع هتل و مقصد

<!-- nora-guide {"id":"hotel-purchase-references","href":"/reservations/hotel-rates","related":["master-data/hotels"],"route":["رزرواسیون","قیمت خرید هتل","مراجع هتل و مقصد"],"terms":["هتل پیدا نمیشه","هتل در فهرست نیست","کارگزار هتل","ارز نرخ هتل","نوع اتاق پیدا"],"examples":["چرا هتل در فهرست نیست؟"],"source":"apps/web/src/modules/reservations/hotel-rates/manual-hotel-panel.tsx"} -->

### مراحل

1. شعبه، کشور و شهر انتخاب‌شده را کنترل کنید. نام هتل را در «جست‌وجوی هتل‌های شهر» وارد کنید.
2. اگر هتل، کارگزار یا نوع اتاق در گزینه‌های مجاز نیست، مرجع مربوط در اطلاعات پایه و ارتباط آن با مقصد را بررسی کنید.

### راهنماهای مرتبط

- [مرجع هتل‌ها](master-data.md#hotels)

<a id="hotel-purchase-occupancy"></a>

## قیمت و ترکیب اتاق

<!-- nora-guide {"id":"hotel-purchase-occupancy","href":"/reservations/hotel-rates","related":["hotel-purchase-rates/hotel-purchase-start"],"route":["رزرواسیون","قیمت خرید هتل","قیمت و ترکیب اتاق"],"terms":["ترکیب اتاق","ضریب","بزرگسال","قیمت پایه","رده سنی کودک","ظرفیت اتاق"],"examples":["چطور ضریب ترکیب اتاق را وارد کنم؟"],"source":"apps/web/src/modules/reservations/hotel-rates/manual-hotel-panel.tsx"} -->

### مراحل

1. نوع اتاق را انتخاب کنید. قیمت پایه، ظرفیت و قیمت ترکیب‌ها را در جدول همان اتاق بررسی کنید.
2. تعداد بزرگسال و کودک، ردهٔ سنی و «ضریب ترکیب اتاق» را برای همان چیدمان کنترل کنید. قیمت ترکیب صریح را از ضریب جدا بخوانید و نتیجهٔ جدول را قبل از ثبت مرور کنید.
3. نمونهٔ نرخ محاسبه‌شده با ضریب: پایهٔ ۱۰۰ دلار و ضریب ۱٫۲۵، قیمت خرید ۱۲۵ دلار می‌دهد. این مثال برای نرخ مبتنی بر ضریب است. نرخ صریح ترکیب را از جدول خود ردیف بخوانید.

### راهنماهای مرتبط

- [انتخاب بخش](#hotel-purchase-start)

<a id="hotel-purchase-period"></a>

## دوره‌ها و بازهٔ مشترک

<!-- nora-guide {"id":"hotel-purchase-period","href":"/reservations/hotel-rates","related":["hotel-purchase-rates/hotel-purchase-start"],"route":["رزرواسیون","قیمت خرید هتل","دوره‌ها و بازهٔ مشترک"],"terms":["بازه مشترک","پایان غیرشامل","دوره نرخ","روز خروج","کپی هتل"],"examples":["پایان غیرشامل یعنی چی؟"],"source":"apps/web/src/modules/reservations/hotel-rates/hotel-periods-panel.tsx"} -->

### مراحل

1. «دوره‌های ثبت‌شده» و تاریخ‌های بازه را بررسی کنید. در بازه با پایان غیرشامل، تاریخ پایان شب قابل‌فروش محسوب نمی‌شود.
2. برای بازهٔ مشترک، شروع و پایان و هتل‌های منتخب را کنترل کنید. اگر انتخاب یا کپی هتل‌های دوره در همان نما در دسترس است، هتل‌ها و بازهٔ مقصد را پیش از ثبت دوباره مرور کنید.

### راهنماهای مرتبط

- [انتخاب بخش](#hotel-purchase-start)

<a id="hotel-purchase-excel"></a>

## ورودی اکسل نرخ‌ها

<!-- nora-guide {"id":"hotel-purchase-excel","href":"/reservations/hotel-rates","related":["hotel-purchase-rates/hotel-purchase-start"],"route":["رزرواسیون","قیمت خرید هتل","ورودی اکسل نرخ‌ها"],"terms":["اکسل نرخ","نگاشت اتاق","بورد نرخ","پیش نمایش فایل"],"examples":["چطور اکسل نرخ و نگاشت اتاق را بررسی کنم؟"],"source":"apps/web/src/modules/reservations/hotel-rates/occupancy-import-panel.tsx"} -->

### مراحل

1. «ورودی اکسل نرخ‌ها» را باز و فایل پشتیبانی‌شده را انتخاب کنید. نتیجهٔ خواندن فایل و خطاهای ردیف را بررسی کنید.
2. در مسیر نگاشت انتخابی، «هتل در فایل»، «بورد نرخ واردشده»، «هتل موجود در شهر بسته» و «نگاشت اتاق» را بررسی کنید. پیش‌نمایش به معنی ذخیره نیست.

### راهنماهای مرتبط

- [انتخاب بخش](#hotel-purchase-start)

<a id="hotel-purchase-bulk"></a>

## ثبت گروهی و ورود مجدد

<!-- nora-guide {"id":"hotel-purchase-bulk","href":"/reservations/hotel-rates","related":["hotel-purchase-rates/hotel-purchase-start"],"route":["رزرواسیون","قیمت خرید هتل","ثبت گروهی و ورود مجدد"],"terms":["ثبت گروهی","ثبت همه هتل ها","ورود مجدد","ردیف خطادار","بخشی از فایل","ردیف room"],"examples":["چرا ثبت گروهی فقط بخشی از فایل را ثبت کرد؟"],"source":"apps/web/src/modules/reservations/hotel-rates/occupancy-bulk-panel.tsx"} -->

### مراحل

1. پیش‌نمایش «ثبت همه هتل‌ها و نرخ‌ها» را مرور کنید. نام مبهم یا غیرفعال نیازمند بررسی دستی است. در بخش هم‌پوشان، نرخ ترکیب مشخص بر ردیف ROOM مقدم است.
2. در ثبت جزئی، ثبت‌های موفق باقی می‌مانند. نتیجهٔ بسته‌های جدید، به‌روزرسانی‌شده و بدون تغییر را در «بسته‌های موجود» بررسی کنید. فقط موارد حل‌نشده را دوباره بررسی و ثبت کنید.

### راهنماهای مرتبط

- [انتخاب بخش](#hotel-purchase-start)

<a id="hotel-purchase-existing"></a>

## بسته‌های موجود و ویرایش

<!-- nora-guide {"id":"hotel-purchase-existing","href":"/reservations/hotel-rates","related":["hotel-purchase-rates/hotel-purchase-start"],"route":["رزرواسیون","قیمت خرید هتل","بسته‌های موجود و ویرایش"],"terms":["بسته های موجود","ویرایش نرخ","تعارض نسخه","نسخه بسته","ثبت نامطمئن"],"examples":["وقتی نسخه بسته تغییر کرده چیکار کنم؟"],"source":"apps/web/src/modules/reservations/hotel-rates/existing-packs-browser.tsx"} -->

### مراحل

1. «بسته‌های موجود» را باز کنید. شهر، تاریخ بسته و هتل را بررسی کنید و نرخ را از بستهٔ منطبق باز کنید.
2. در تعارض نسخه، تازه‌سازی کنید و تغییرتان را با نسخهٔ جاری تطبیق دهید. اگر پاسخ ثبت نامشخص بود، پیش از تکرار، نرخ ذخیره‌شده و نسخهٔ بسته را بررسی کنید.

### راهنماهای مرتبط

- [انتخاب بخش](#hotel-purchase-start)

<a id="hotel-purchase-archive"></a>

## حذف بسته

<!-- nora-guide {"id":"hotel-purchase-archive","href":"/reservations/hotel-rates","related":["hotel-purchase-rates/hotel-purchase-start"],"route":["رزرواسیون","قیمت خرید هتل","حذف بسته"],"terms":["حذف بسته","کنارگذاری بسته","بسته آرشیو"],"examples":["حذف بسته چه فرقی با پاک شدن سابقه داره؟"],"source":"apps/web/src/modules/reservations/hotel-rates/pack-archive-panel.tsx"} -->

### مراحل

1. در کارت «حذف بسته»، بسته را با شعبه، شهر و تاریخ تطبیق دهید. فقط در صورت داشتن مجوز و اطمینان از انتخاب، تأیید کنید.
2. کنارگذاری بسته را از انتخاب‌های جدید خارج می‌کند و سابقه را نگه می‌دارد. قیمت منتشرشده را در نمای همان انتشار بررسی کنید.

### راهنماهای مرتبط

- [انتخاب بخش](#hotel-purchase-start)

<a id="hotel-purchase-access"></a>

## دسترسی و وضعیت بسته

<!-- nora-guide {"id":"hotel-purchase-access","href":"/reservations/hotel-rates","related":["hotel-purchase-rates/hotel-purchase-start"],"route":["رزرواسیون","قیمت خرید هتل","دسترسی و وضعیت بسته"],"terms":["مجوز","شعبه","دسترسی","خطای بارگیری","خالی"],"examples":["چرا مجوز ویرایش بسته را ندارم؟"],"source":"apps/web/src/modules/reservations/hotel-rates/packs-workspace.tsx"} -->

### مراحل

1. شعبه و نشست فعال را بررسی کنید. خواندن بسته به دسترسی مشاهده رزرواسیون و ثبت، اصلاح و کنارگذاری به مجوز نوشتن خرید هتل نیاز دارند.
2. اگر بارگیری ناموفق بود، پیام پنل را بررسی و بعد از برقراری اتصال تازه‌سازی کنید. برای فهرست خالی، ابتدا شهر، تاریخ و وضعیت بسته را کنترل کنید.

### راهنماهای مرتبط

- [انتخاب بخش](#hotel-purchase-start)

<a id="hotel-purchase-tour"></a>

## انتخاب نرخ در قیمت‌گذاری تور

<!-- nora-guide {"id":"hotel-purchase-tour","href":"/reservations/hotel-rates","related":["tour/hotel"],"route":["رزرواسیون","قیمت خرید هتل","انتخاب نرخ در قیمت‌گذاری تور"],"terms":["قیمت گذاری تور","نوبت تور","نرخ قابل انتخاب","قیمت منتشرشده"],"examples":["چرا نرخ این بسته در قیمت‌گذاری تور نیست؟"],"source":"apps/web/src/modules/reservations/hotel-rates/packs-workspace.tsx"} -->

### مراحل

1. از نوبت تور یا کنترل قیمت‌گذاری مرتبط، شعبه، مقصد، هتل و پوشش بازهٔ سفر را با بستهٔ نرخ تطبیق دهید. وضعیت کنارگذاری را بررسی کنید.
2. قیمت خرید بسته، نرخ قابل انتخاب و قیمت منتشرشده سه مرحله‌اند. خروجی قبلی را از نمای همان انتشار بررسی کنید.

### راهنماهای مرتبط

- [راهنمای تور](tour.md#hotel)

<a id="hotel-purchase-purchase"></a>

## خرید اقامت، واچر و گزارش

<!-- nora-guide {"id":"hotel-purchase-purchase","href":"/reservations/hotel-rates","related":["reservations/hotel"],"route":["رزرواسیون","قیمت خرید هتل","خرید اقامت، واچر و گزارش"],"terms":["واچر","خرید اقامت","ارسال به کارگزار","گزارش نرخ"],"examples":["نرخ خرید هتل رو ثبت کردم چرا واچر صادر نشده؟"],"source":"apps/web/src/modules/reservations/hotel-rates/../components/reservation-hotel-purchase.tsx"} -->

### مراحل

1. خدمت هتل را در پروندهٔ رزرواسیون باز کنید. خرید اقامت، وضعیت ارسال به کارگزار و صدور واچر هرکدام کنترل مربوط به همان پرونده را دارند.
2. برای سؤال گزارش، منبع و فیلتر گزارش را کنترل کنید. نرخ ثبت‌شده به‌تنهایی مبلغ خرید قطعی، پرداخت یا فروش را مشخص نمی‌کند.

### راهنماهای مرتبط

- [واچر و اقامت](reservations.md#hotel)
