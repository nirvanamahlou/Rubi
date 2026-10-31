'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

// Only the introduction was accessible in the source. The owner explicitly
// requested empty later stages, rather than inferred inputs or issuing actions.
export function AccountingObservedYearEnd({
  mode,
}: {
  mode: 'closing' | 'nature-adjustment';
}) {
  const [step, setStep] = useState(0);
  const closing = mode === 'closing';
  const title = closing ? 'صدور سند بستن حساب ها' : 'صدور سند تعدیل ماهیت';
  const steps = closing
    ? [
        'شرح راهبر',
        'انتخاب الگوی بستن حساب',
        'تعریف نرخ ارز',
        'پیش نمایش سند',
        'پایان عملیات',
      ]
    : [
        'شرح راهبر',
        'مشخصات سند',
        'حساب های بدون طرف مقابل',
        'پیش نمایش سند',
        'پایان عملیات صدور سند تعدیل ماهیت',
      ];
  return (
    <section
      aria-label={title}
      className="grid min-h-96 gap-4 md:grid-cols-[15rem_1fr]"
      dir="rtl"
    >
      <nav aria-label="مراحل راهبر" className="border-e pe-3">
        <ol className="space-y-1">
          {steps.map((label, index) => (
            <li key={label}>
              <Button
                type="button"
                variant={step === index ? 'secondary' : 'ghost'}
                className="h-auto w-full justify-start whitespace-normal text-start"
                aria-current={step === index ? 'step' : undefined}
                onClick={() => setStep(index)}
              >
                {index + 1}. {label}
              </Button>
            </li>
          ))}
        </ol>
      </nav>
      <div role="region" aria-label={steps[step]} className="min-h-80">
        {step === 0 ? (
          <>
            <div className="mb-6 flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
              >
                ادامه
              </Button>
            </div>
            <h2 className="mb-4 text-lg font-bold">{title}</h2>
            <p className="leading-8">
              {closing
                ? 'این راهبر به منظور صدور سند بستن حساب ها به کار برده می شود. هدف از بستن حساب ها، انتقال مانده حساب های موقت به یک یا چند حساب طرف مقابل با درصدی مشخص است به طوریکه این حساب ها و درصد آن ها از طریق انتخاب یکی از الگوهای از پیش تعیین شده، مشخص می شود.'
                : 'سند تعدیل ماهیت حاصل صفر کردن مانده حساب های معین دارای وضعیت خلاف ماهیت می باشد. صدور سند تعدیل ماهیت شامل مراحل زیر می باشد:'}
            </p>
            <ul className="mt-4 list-inside list-disc space-y-2">
              {(closing
                ? ['انتخاب الگوی بستن حساب', 'پیش نمایش سند', 'پایان عملیات']
                : [
                    'تعریف مشخصات سند',
                    'تعریف حساب های طرف مقابل',
                    'پایان عملیات صدور سند تعدیل ماهیت',
                  ]
              ).map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </section>
  );
}
