'use client';

import { CheckCircle2, MessageSquareHeart } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { FormField, Textarea } from '@/components/ui/form-controls';
import { Alert, Card } from '@/components/ui/surfaces';
import { customerAffairsApi } from '@/modules/customer-affairs/api/customer-affairs-client';

export default function CustomerAffairsSatisfactionPage() {
  const params = useParams<{ token: string }>();
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const comment = String(data.get('comment')).trim();
      await customerAffairsApi.submitSatisfaction(params.token, {
        score: Number(data.get('score')),
        ...(comment ? { comment } : {}),
      });
      setSubmitted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ثبت پاسخ انجام نشد.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className="grid min-h-screen place-items-center bg-muted/30 px-4 py-10"
      id="main-content"
    >
      <Card className="w-full max-w-xl p-6 sm:p-8">
        {submitted ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
            <h1 className="mt-4 text-xl font-black">
              از بازخورد شما سپاسگزاریم
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              پاسخ شما با موفقیت و فقط یک‌بار ثبت شد.
            </p>
          </div>
        ) : (
          <>
            <MessageSquareHeart className="size-10 text-primary" />
            <h1 className="mt-4 text-xl font-black">
              رضایت از رسیدگی امور مشتریان
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              این فرم مخصوص مشتری است و نام یا جزئیات پرونده را نمایش نمی‌دهد.
            </p>
            <form className="mt-6 space-y-5" onSubmit={submit}>
              <fieldset>
                <legend className="text-sm font-bold">
                  امتیاز شما از ۱ تا ۵
                </legend>
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <label
                      className="cursor-pointer rounded-xl border border-border p-3 text-center has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                      key={score}
                    >
                      <input
                        className="sr-only"
                        name="score"
                        required
                        type="radio"
                        value={score}
                      />
                      <span className="font-black">
                        {score.toLocaleString('fa-IR')}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <FormField label="توضیح تکمیلی (اختیاری)">
                <Textarea maxLength={1000} name="comment" />
              </FormField>
              {error ? (
                <Alert title="ثبت ناموفق" description={error} tone="error" />
              ) : null}
              <Button className="w-full" disabled={busy} type="submit">
                {busy ? 'در حال ثبت…' : 'ثبت بازخورد'}
              </Button>
            </form>
          </>
        )}
      </Card>
    </main>
  );
}
