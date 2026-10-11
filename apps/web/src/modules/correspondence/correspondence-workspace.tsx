'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { FileImage, FileText, WandSparkles, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  companies,
  composeLetter,
  initialTemplate,
  type Letter,
} from './letter';
import { letterDownloads, renderLetterPages } from './letter-export';

export function CorrespondenceWorkspace() {
  const [letter, setLetter] = useState<Letter>({
    company: companies[0].title,
    recipient: '',
    subject: '',
    date: new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran' }).format(
      new Date(),
    ),
    number: '',
    signer: '',
    text: '',
    template: initialTemplate,
  });
  const [preview, setPreview] = useState<string[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<{ url: string; name: string }[]>([]);
  useEffect(
    () => () => files.forEach((file) => URL.revokeObjectURL(file.url)),
    [files],
  );
  const update = (key: keyof Letter, value: string) => {
    setLetter({ ...letter, [key]: value });
    setPreview([]);
    setFiles([]);
    setBody('');
    setError('');
  };
  const generate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    setFiles([]);
    try {
      const text = composeLetter(letter);
      const pages = await renderLetterPages(letter, text);
      setBody(text);
      setPreview(pages.map((page) => page.toDataURL('image/png')));
    } catch (cause) {
      setPreview([]);
      setBody('');
      setError(
        cause instanceof Error ? cause.message : 'تولید نامه ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  };
  const download = async (format: 'png' | 'pdf') => {
    if (!body) return;
    setBusy(true);
    setError('');
    try {
      const outputs = await letterDownloads(letter, body, format);
      setFiles(
        outputs.map(({ blob, name }) => ({
          url: URL.createObjectURL(blob),
          name,
        })),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'ساخت خروجی ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  };
  const inputClass =
    'mt-2 w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';
  return (
    <section dir="rtl" className="space-y-6">
      <header className="flex items-center gap-3">
        <span className="rounded-2xl bg-primary/10 p-3 text-primary">
          <Mail />
        </span>
        <div>
          <h1 className="text-2xl font-bold">مکاتبات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            تولید نامه از قالب و متن شما، با خروجی عکس و PDF
          </p>
        </div>
      </header>
      <div className="grid gap-6 xl:grid-cols-[minmax(340px,0.85fr)_minmax(0,1.15fr)]">
        <form
          onSubmit={(event) => void generate(event)}
          className="space-y-5 rounded-2xl border bg-surface p-5 shadow-sm"
        >
          <h2 className="font-bold">اطلاعات نامه</h2>
          <label className="block text-sm font-medium">
            شرکت
            <select
              className={inputClass}
              value={letter.company}
              disabled={busy}
              onChange={(event) => update('company', event.target.value)}
            >
              {companies.map((company) => (
                <option key={company.id} value={company.title}>
                  {company.title}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              ['recipient', 'subject', 'date', 'number', 'signer'] as const
            ).map((key) => (
              <label
                key={key}
                className={`block text-sm font-medium ${key === 'subject' ? 'sm:col-span-2' : ''}`}
              >
                {
                  {
                    recipient: 'گیرنده',
                    subject: 'موضوع',
                    date: 'تاریخ',
                    number: 'شماره نامه',
                    signer: 'نام و سمت امضاکننده',
                  }[key]
                }
                <input
                  className={inputClass}
                  value={letter[key]}
                  required={key === 'recipient' || key === 'subject'}
                  maxLength={
                    key === 'subject' || key === 'recipient' ? 160 : 80
                  }
                  disabled={busy}
                  onChange={(event) => update(key, event.target.value)}
                />
              </label>
            ))}
          </div>
          <label className="block text-sm font-medium">
            متن ورودی
            <textarea
              className={inputClass}
              rows={7}
              required
              maxLength={20000}
              value={letter.text}
              disabled={busy}
              onChange={(event) => update('text', event.target.value)}
              placeholder="متن اصلی نامه را وارد کنید…"
            />
          </label>
          <details className="rounded-xl border p-4">
            <summary className="cursor-pointer text-sm font-semibold">
              ویرایش قالب نامه
            </summary>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              متغیرهای قالب:{' '}
              {
                '{{متن}}، {{امضا}}، {{شرکت}}، {{گیرنده}}، {{موضوع}}، {{تاریخ}} و {{شماره}}'
              }
            </p>
            <textarea
              aria-label="قالب نامه"
              className={inputClass}
              rows={8}
              value={letter.template}
              maxLength={10000}
              disabled={busy}
              onChange={(event) => update('template', event.target.value)}
            />
          </details>
          <Button type="submit" disabled={busy}>
            <WandSparkles className="size-4" />
            {busy ? 'در حال آماده‌سازی…' : 'تولید نامه'}
          </Button>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
        <div className="min-w-0 rounded-2xl border bg-muted/30 p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold">پیش‌نمایش نامه</h2>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!body || busy}
                onClick={() => void download('png')}
              >
                <FileImage className="size-4" />
                خروجی عکس
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!body || busy}
                onClick={() => void download('pdf')}
              >
                <FileText className="size-4" />
                خروجی PDF
              </Button>
            </div>
          </div>
          {files.length > 0 && (
            <div
              role="status"
              className="mb-4 rounded-xl border bg-surface p-3 text-sm"
            >
              <p>فایل آماده است؛ برای دانلود روی آن بزنید.</p>
              {files.map((file) => (
                <a
                  key={file.url}
                  href={file.url}
                  download={file.name}
                  className="mt-2 block text-primary underline"
                  dir="ltr"
                >
                  {file.name}
                </a>
              ))}
            </div>
          )}
          {preview.length ? (
            preview.map((url, index) => (
              <figure key={index} className="mb-4">
                <Image
                  unoptimized
                  src={url}
                  alt={`پیش‌نمایش صفحه ${index + 1} نامه ${letter.company}`}
                  width={1240}
                  height={1754}
                  className="h-auto w-full rounded-sm border bg-white shadow-md"
                />
                <figcaption className="mt-2 text-center text-xs text-muted-foreground">
                  صفحه {index + 1}
                </figcaption>
              </figure>
            ))
          ) : (
            <div className="flex min-h-96 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center text-muted-foreground">
              <FileText className="mb-4 size-12 opacity-40" />
              <p>اطلاعات و متن را وارد کنید و «تولید نامه» را بزنید.</p>
              <p className="mt-2 text-xs">
                قالب اولیه با سربرگ شرکت انتخاب‌شده ساخته می‌شود.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
