import type { InsurancePassengerInputV1 } from '@nora/contracts';
import { Input } from '@/components/ui/form-controls';
import { DatePicker } from '@/components/ui/date-picker';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import styles from './workspace.module.css';

export function InsuranceInputGuide({
  standalone = false,
}: { standalone?: boolean } = {}) {
  return (
    <details className={styles.card}>
      <summary>اطلاعات لازم برای صدور بیمه و روش ورود</summary>
      <p>
        نام و نام خانوادگی فارسی و لاتین را مطابق گذرنامه وارد کنید. نام لاتین
        فقط با حروف انگلیسی، فاصله، نقطه، خط تیره یا آپاستروف ثبت شود.
      </p>
      <p>
        تاریخ تولد واقعی و جنسیت را مشخص کنید. کد ملی ایرانی باید ۱۰ رقم معتبر
        با صفرهای ابتدایی باشد. برای تبعه خارجی، تابعیت سه‌حرفی مانند TUR و
        شماره گذرنامه واقعی ثبت شود؛ شناسه ارسالی بیمه‌گر برای غیرایرانی از
        گذرنامه خوانده می‌شود.
      </p>
      <p>
        شماره گذرنامه با حروف بزرگ انگلیسی و ارقام، بدون فاصله؛ موبایل با ۱۰ تا
        ۱۵ رقم بدون فاصله (ایران مانند 09123456789، بین‌المللی با پیش‌شماره
        کشور) و ایمیل معتبر مانند name@example.com وارد شود. اطلاعات ساختگی وارد
        نکنید.
      </p>
      <p>
        کشور مقصد و طرح فعال را از فهرست بیمه انتخاب کنید. تاریخ سفر از تقویم و
        مدت بیمه از فهرست مدت‌های مجاز بیمه‌گر انتخاب شود؛ روز رفت و برگشت را در
        مدت پوشش لحاظ کنید.
        {standalone
          ? ' کشور مبدأ را انتخاب کنید؛ قرارداد فروش لازم نیست. '
          : ' کشور مبدأ از قرارداد خوانده می‌شود. '}
        تاریخ تولد به میلادی ارسال می‌شود؛ متد صدور مستندشده فیلد جداگانه تاریخ
        شروع سفر ندارد و تاریخ سفر در درخواست داخلی سامانه نگهداری می‌شود.
      </p>
      <p>
        شماره و مبلغ بیمه پس از تأیید بیمه‌گر ثبت می‌شود. در حالت آزمایشی، خروجی
        بیمه‌نامه واقعی نیست.
        {!standalone && ' اصلاح اطلاعات مسافر در پرونده او نیز ذخیره می‌شود.'}
      </p>
      <a
        href="https://sandboxapi.travis.ir/swagger/index.html"
        target="_blank"
        rel="noreferrer"
      >
        مستندات رسمی تراویس
      </a>
    </details>
  );
}
export function InsurancePassengerFields({
  value,
  onChange,
  disabled,
}: {
  value: InsurancePassengerInputV1;
  onChange: (value: InsurancePassengerInputV1) => void;
  disabled: boolean;
}) {
  const fields = [
    ['firstName', 'نام فارسی', ''],
    ['lastName', 'نام خانوادگی فارسی', ''],
    ['firstNameLatin', 'نام انگلیسی مطابق پاسپورت', 'ALI'],
    ['lastNameLatin', 'نام خانوادگی انگلیسی مطابق پاسپورت', 'AHMADI'],
    ['nationalityCode', 'کد تابعیت سه‌حرفی', 'IRN'],
    ['nationalCode', 'کد ملی ایرانی', '۱۰ رقم'],
    ['passportNo', 'شماره گذرنامه', 'A12345678'],
    ['mobile', 'موبایل بیمه‌شده', '09123456789'],
    ['email', 'ایمیل بیمه‌شده', 'name@example.com'],
  ] as const;
  return (
    <fieldset className={styles.card} disabled={disabled}>
      <legend>اطلاعات بیمه‌شده</legend>
      <div className={styles.fields}>
        {fields.map(([key, label, placeholder]) => (
          <label key={key}>
            {label}
            <Input
              required={
                key !== 'nationalCode' || value.nationalityCode === 'IRN'
              }
              value={value[key]}
              placeholder={placeholder}
              dir={key === 'firstName' || key === 'lastName' ? 'rtl' : 'ltr'}
              type={key === 'email' ? 'email' : 'text'}
              maxLength={
                key === 'nationalityCode'
                  ? 3
                  : key === 'nationalCode'
                    ? 10
                    : key === 'mobile'
                      ? 16
                      : key === 'passportNo'
                        ? 24
                        : key === 'email'
                          ? 160
                          : 120
              }
              onChange={(e) => {
                let text = e.target.value;
                if (['nationalCode', 'mobile'].includes(key))
                  text = text.replace(/[۰-۹٠-٩]/g, (c) =>
                    String(
                      '۰۱۲۳۴۵۶۷۸۹'.includes(c)
                        ? '۰۱۲۳۴۵۶۷۸۹'.indexOf(c)
                        : '٠١٢٣٤٥٦٧٨٩'.indexOf(c),
                    ),
                  );
                if (['nationalityCode', 'passportNo'].includes(key))
                  text = text.toUpperCase();
                onChange({ ...value, [key]: text });
              }}
            />
          </label>
        ))}
        <label>
          تاریخ تولد
          <DatePicker
            value={value.birthDate}
            onChange={(birthDate) => onChange({ ...value, birthDate })}
          />
        </label>
        <label>
          جنسیت
          <NativeSearchSelect
            required
            value={value.gender}
            onChange={(e) =>
              onChange({ ...value, gender: e.target.value as 'M' | 'F' })
            }
          >
            <option value="">انتخاب جنسیت</option>
            <option value="M">مرد</option>
            <option value="F">زن</option>
          </NativeSearchSelect>
        </label>
      </div>
    </fieldset>
  );
}
