'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  FileImage,
  FileText,
  WandSparkles,
  Mail,
  Send,
  Save,
} from 'lucide-react';
import type { InternalLetterRecord } from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui';
import { issueLetterNumber, internalLetters } from './api';
import { LetterRecipientDialog } from './internal-controls';
import {
  companies,
  composeLetter,
  initialTemplate,
  letterTemplates,
  type Letter,
} from './letter';
import { letterDownloads, renderLetterPages } from './letter-export';

export function OutgoingLetterWorkspace({
  internal = false,
  initialRecord,
  readOnly = false,
  onSaved,
}: {
  internal?: boolean;
  initialRecord?: InternalLetterRecord;
  readOnly?: boolean;
  onSaved?: () => void;
}) {
  const [sendOpen, setSendOpen] = useState(false);
  const sendKey = useRef<string | null>(null);
  const [savedVersion, setSavedVersion] = useState(initialRecord?.version);
  const [notice, setNotice] = useState('');
  const [sent, setSent] = useState(false);
  const requestKey = useRef<string | null>(null);
  const [templateId, setTemplateId] = useState<string>('general');
  const [letterDate, setLetterDate] = useState(
    () =>
      initialRecord?.dateISO ??
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tehran',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()),
  );
  const [letter, setLetter] = useState<Letter>(
    initialRecord?.letter ?? {
      company: companies[0].title,
      recipient: '',
      recipientTitle: '',
      sender: '',
      subject: '',
      date: new Intl.DateTimeFormat('fa-IR', {
        timeZone: 'Asia/Tehran',
      }).format(new Date()),
      number: '',
      attachment: '',
      signer: '',
      text: '',
      template: initialTemplate,
    },
  );
  const [preview, setPreview] = useState<string[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<{ url: string; name: string }[]>([]);
  useEffect(() => {
    if (!initialRecord) return;
    let live = true;
    const text = composeLetter(initialRecord.letter);
    void renderLetterPages(initialRecord.letter, text)
      .then((pages) => {
        if (live) {
          setBody(text);
          setPreview(pages.map((page) => page.toDataURL('image/png')));
        }
      })
      .catch((cause) => {
        if (live)
          setError(
            cause instanceof Error ? cause.message : 'تولید نامه ناموفق بود.',
          );
      });
    return () => {
      live = false;
    };
  }, [initialRecord]);
  useEffect(
    () => () => files.forEach((file) => URL.revokeObjectURL(file.url)),
    [files],
  );
  const update = (key: keyof Letter, value: string) => {
    setNotice('');
    if (key === 'company') requestKey.current = null;
    setLetter({
      ...letter,
      [key]: value,
      ...(key === 'company' ? { number: '' } : {}),
    });
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
      let numberedLetter = letter;
      if (!letter.number) {
        // Validate artwork before consuming a persistent number; retries reuse the same key.
        await renderLetterPages(letter, text);
        requestKey.current ??= crypto.randomUUID();
        const company = companies.find(
          (company) => company.title === letter.company,
        )!;
        const result = await issueLetterNumber(
          company.id,
          letterDate,
          requestKey.current,
        );
        numberedLetter = {
          ...letter,
          number: result.number,
          date: result.date.replace(
            /\d/g,
            (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]!,
          ),
        };
        setLetter(numberedLetter);
      }
      const finalText = composeLetter(numberedLetter);
      const pages = await renderLetterPages(numberedLetter, finalText);
      setBody(finalText);
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
          <h1 className="text-2xl font-bold">
            {internal
              ? readOnly
                ? 'مشاهده نامه داخلی'
                : initialRecord
                  ? 'ویرایش نامه داخلی'
                  : 'ارسال نامه داخلی'
              : 'نامه‌های خروجی'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            تولید نامه از قالب و متن شما، با خروجی عکس و PDF
          </p>
        </div>
        <Link
          href={internal ? '/correspondence/internal' : '/correspondence'}
          className="ms-auto text-sm text-primary underline"
        >
          {internal ? 'بازگشت به مکاتبات داخلی' : 'بازگشت به مکاتبات'}
        </Link>
      </header>
      <div className="grid gap-6 xl:grid-cols-[minmax(340px,0.85fr)_minmax(0,1.15fr)]">
        <form
          onSubmit={(event) => void generate(event)}
          className="space-y-5 rounded-2xl border bg-surface p-5 shadow-sm"
        >
          <fieldset
            disabled={readOnly || busy || sent}
            className="space-y-5 min-w-0"
          >
            <h2 className="font-bold">اطلاعات نامه</h2>
            <label className="block text-sm font-medium">
              قالب آماده
              <select
                className={inputClass}
                value={templateId}
                disabled={busy || readOnly || sent}
                onChange={(event) => {
                  setTemplateId(event.target.value);
                  update(
                    'template',
                    letterTemplates.find(
                      (item) => item.id === event.target.value,
                    )!.body,
                  );
                }}
              >
                {letterTemplates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              شرکت
              <select
                className={inputClass}
                value={letter.company}
                disabled={busy || readOnly || sent || !!initialRecord}
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
                [
                  'recipient',
                  'recipientTitle',
                  'sender',
                  'subject',
                  'attachment',
                  'signer',
                ] as const
              ).map((key) => (
                <label
                  key={key}
                  className={`block text-sm font-medium ${key === 'subject' ? 'sm:col-span-2' : ''}`}
                >
                  {
                    {
                      recipient: 'گیرنده',
                      recipientTitle: 'عنوان گیرنده',
                      sender: 'فرستنده',
                      subject: 'موضوع',
                      attachment: 'پیوست',
                      signer: 'نام و سمت امضاکننده',
                    }[key]
                  }
                  <input
                    className={inputClass}
                    value={letter[key] ?? ''}
                    required={
                      key === 'recipient' ||
                      key === 'subject' ||
                      key === 'sender'
                    }
                    maxLength={
                      key === 'subject' || key === 'recipient' ? 160 : 80
                    }
                    disabled={busy || readOnly || sent}
                    onChange={(event) => update(key, event.target.value)}
                  />
                </label>
              ))}
              <label className="block text-sm font-medium">
                تاریخ نامه
                <DatePicker
                  aria-label="تاریخ نامه"
                  value={letterDate}
                  disabled={busy || readOnly || sent || !!initialRecord}
                  onChange={(value) => {
                    if (!value) return;
                    requestKey.current = null;
                    setLetterDate(value);
                    update(
                      'date',
                      new Intl.DateTimeFormat('fa-IR', {
                        timeZone: 'Asia/Tehran',
                      }).format(new Date(`${value}T12:00:00+03:30`)),
                    );
                    setLetter((current) => ({ ...current, number: '' }));
                  }}
                />
              </label>
            </div>
            {letter.number && (
              <p role="status" className="rounded-xl bg-primary/5 p-3 text-sm">
                شماره نامه: <b dir="ltr">{letter.number}</b>
              </p>
            )}
            <label className="block text-sm font-medium">
              متن ورودی
              <textarea
                className={inputClass}
                rows={7}
                required
                maxLength={20000}
                value={letter.text}
                disabled={busy || readOnly || sent}
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
                  '{{متن}}، {{امضا}}، {{شرکت}}، {{گیرنده}}، {{مخاطب}}، {{فرستنده}}، {{موضوع}}، {{تاریخ}}، {{شماره}} و {{پیوست}}'
                }
              </p>
              <textarea
                aria-label="قالب نامه"
                className={inputClass}
                rows={8}
                value={letter.template}
                maxLength={10000}
                disabled={busy || readOnly || sent}
                onChange={(event) => update('template', event.target.value)}
              />
            </details>
            {!readOnly && (
              <Button type="submit" disabled={busy || sent}>
                <WandSparkles className="size-4" />
                {busy ? 'در حال آماده‌سازی…' : 'تولید نامه'}
              </Button>
            )}
            {!readOnly && !initialRecord && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  requestKey.current = null;
                  sendKey.current = null;
                  setSent(false);
                  setNotice('');
                  setLetter((current) => ({
                    ...current,
                    number: '',
                    recipient: '',
                    recipientTitle: '',
                    sender: '',
                    subject: '',
                    text: '',
                    signer: '',
                    attachment: '',
                  }));
                  setPreview([]);
                  setFiles([]);
                  setBody('');
                  setError('');
                }}
              >
                نامه جدید
              </Button>
            )}
          </fieldset>
          {sent && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                sendKey.current = null;
                requestKey.current = null;
                setSent(false);
                setNotice('');
                setLetter((current) => ({ ...current, number: '' }));
                setBody('');
                setPreview([]);
                setFiles([]);
              }}
            >
              نامه جدید
            </Button>
          )}
          {notice && (
            <p role="status" className="rounded-xl bg-primary/5 p-3 text-sm">
              {notice}
            </p>
          )}
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
              {internal &&
                !readOnly &&
                (initialRecord ? (
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      setError('');
                      void internalLetters
                        .edit(initialRecord.id, savedVersion!, letter)
                        .then((result) => {
                          setSavedVersion(result.version);
                          setNotice('تغییرات نامه ذخیره شد.');
                          onSaved?.();
                        })
                        .catch((cause) =>
                          setError(
                            cause instanceof Error
                              ? cause.message
                              : 'ذخیره نامه ناموفق بود.',
                          ),
                        )
                        .finally(() => setBusy(false));
                    }}
                  >
                    <Save className="size-4" />
                    ذخیره تغییرات
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled={!body || busy || sent}
                    onClick={() => setSendOpen(true)}
                  >
                    <Send className="size-4" />
                    ارسال
                  </Button>
                ))}
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
      {internal && !initialRecord && (
        <LetterRecipientDialog
          open={sendOpen}
          onOpenChange={setSendOpen}
          onSubmit={async (recipientId) => {
            sendKey.current ??= crypto.randomUUID();
            await internalLetters.send(
              letter,
              letterDate,
              recipientId,
              sendKey.current,
            );
            setSent(true);
            setNotice('نامه به دریافتی کاربر مقصد ارسال شد.');
          }}
        />
      )}
    </section>
  );
}
