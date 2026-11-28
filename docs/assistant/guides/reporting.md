# راهنمای گزارش‌های سازمانی

<!-- nora-catalogue {} -->

<a id="branch-sales"></a>

## مقایسه فروش شعب

<!-- nora-guide {"id":"branch-sales","href":"/reports","permission":"reporting.sales.read","related":[],"terms":["گزارش عملکرد فروش","عملکرد شعب","مقایسه فروش شعب"]} -->

### مراحل

1. در «اسناد و گزارش‌ها ← گزارش‌ها»، گزارش فروش براساس شرکت، سایت، شعبه و کارشناس (RPT-001) را باز کنید. شرکت فعال و بازهٔ تاریخ را کنترل کنید.
2. فیلتر «شعبه» را برای هر شعبهٔ مجاز انتخاب و «نمایش نتیجه» را بزنید. برای مقایسه، بازه، وضعیت قرارداد و ارز را ثابت نگه دارید و فقط شعبه را عوض کنید.
3. تعداد قرارداد و مبلغ فروش را جدا بخوانید. برای مقایسهٔ مبالغ، ارزهای متفاوت را با هم جمع نکنید.

### مرجع

[reporting-workspace.tsx](../../../apps/web/src/modules/reports/components/reporting-workspace.tsx)

[reporting.ts](../../../apps/web/src/modules/reports/model/reporting.ts)

[reporting-native-sales.ts](../../../apps/api/src/reporting/reporting-native-sales.ts)

<a id="branch-reservations"></a>

## مقایسه گزارش فروش و رزرواسیون

<!-- nora-guide {"id":"branch-reservations","href":"/reports","permission":"reporting.reservations.read","related":[],"terms":["مقایسه فروش و رزرواسیون","گزارش رزرواسیون شعب"]} -->

### مراحل

1. در کاتالوگ گزارش‌ها، برای عملیات رزرواسیون «کدام رزروها برای تحویل آماده نیستند و مانع هرکدام چیست؟» (RPT-024) را باز کنید.
2. شرکت، شعبه و بازه را با گزارش فروش یکسان بگیرید. تعداد قرارداد فروش و تعداد رزرو را جدا گزارش کنید. این دو گزارش تعریف و واحد شمارش متفاوت دارند.

### مرجع

[reporting-workspace.tsx](../../../apps/web/src/modules/reports/components/reporting-workspace.tsx)

[reporting.ts](../../../apps/web/src/modules/reports/model/reporting.ts)

[reporting.catalog.ts](../../../apps/api/src/reporting/reporting.catalog.ts)

<a id="receivables"></a>

## مانده مطالبات طرف حساب

<!-- nora-guide {"id":"receivables","href":"/reports","permission":"reporting.finance.read","related":[],"terms":["مانده مطالبات","مطالبات مشتریان","مطالبات و بدهی ها"]} -->

### مراحل

1. در گزارش‌ها ← مالی و خزانه‌داری، «بیشترین مطالبات و بدهی شرکت مربوط به چه اشخاصی است؟» (RPT-005) را باز کنید.
2. شرکت، شعبه، بازهٔ تاریخ و طرف حساب را در فیلترهای در دسترس انتخاب کنید و «نمایش نتیجه» را بزنید. مانده هر ارز را جدا بخوانید. این گزارش بر پایه سندهای مالی قطعی است.
3. برای ماندهٔ مرتبط با قرارداد فروش، نمای «قراردادها ← مانده قابل دریافت» را جدا بررسی کنید. دامنه و مبنای تاریخ این دو گزارش را قبل از مقایسه کنترل کنید.

### مرجع

[reporting-workspace.tsx](../../../apps/web/src/modules/reports/components/reporting-workspace.tsx)

[reporting.ts](../../../apps/web/src/modules/reports/model/reporting.ts)

[reporting.catalog.ts](../../../apps/api/src/reporting/reporting.catalog.ts)

<a id="delivery"></a>

## گزارش آمادگی تحویل مدارک

<!-- nora-guide {"id":"delivery","href":"/reports","permission":"reporting.reservations.read","related":[],"terms":["مانع تحویل مدارک","آمادگی تحویل مدارک"]} -->

### مراحل

1. برای بررسی وضعیت در سطح شرکت، در گزارش‌ها RPT-024 را باز کنید و شرکت، بازه، شعبه و مانع تحویل را فیلتر کنید.
2. از جزئیات نتیجه، آخرین وضعیت رزرو، خریدهای ناقص و تأیید تحویل مالی را بررسی کنید. برای اقدام روی یک پرونده، «مالی ← تحویل مدارک» را باز کنید. در آن پنل یک شرکت و سال مالی فعال یا پیش‌فرض همان شرکت لازم است. سپس با شمارهٔ قرارداد جست‌وجو کنید.

### مرجع

[reporting-workspace.tsx](../../../apps/web/src/modules/reports/components/reporting-workspace.tsx)

[reporting.ts](../../../apps/web/src/modules/reports/model/reporting.ts)

[reporting.catalog.ts](../../../apps/api/src/reporting/reporting.catalog.ts)
