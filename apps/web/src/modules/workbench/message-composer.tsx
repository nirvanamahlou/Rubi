'use client';

import { useRef, useState } from 'react';
import {
  MessageCircleMore,
  Paperclip,
  Send,
  Smile,
  Sparkles,
  X,
} from 'lucide-react';
import { Alert, Button, Card, Input, Textarea } from '@/components/ui';
import { MessageUnitIcon } from './message-unit-icon';
import { messageUnits } from './message-templates';
import {
  insertMessageEmoji,
  messageEmojis,
  MESSAGE_DRAFT_LIMIT,
} from './emoji';

export function MessageComposer({
  initialUnit = 'finance',
}: {
  initialUnit?: string;
}) {
  const [text, setText] = useState('');
  const [unitId, setUnitId] = useState<string>(
    messageUnits.some((item) => item.id === initialUnit)
      ? initialUnit
      : 'finance',
  );
  const unit = messageUnits.find((item) => item.id === unitId)!;
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [unitSearch, setUnitSearch] = useState('');
  const [attachments, setAttachments] = useState<Record<string, File[]>>({});
  const files = attachments[unitId] ?? [];
  const [error, setError] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const selection = useRef({ start: 0, end: 0 });
  function rememberSelection() {
    if (input.current)
      selection.current = {
        start: input.current.selectionStart,
        end: input.current.selectionEnd,
      };
  }
  function addEmoji(emoji: string) {
    const result = insertMessageEmoji(
      text,
      emoji,
      selection.current.start,
      selection.current.end,
    );
    if (!result) {
      setError(
        'ظرفیت متن پیام پر شده است. برای افزودن ایموجی، بخشی از متن را کم کنید.',
      );
      return;
    }
    setText(result.text);
    setError('');
    setPicker(false);
    selection.current = { start: result.caret, end: result.caret };
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(result.caret, result.caret);
    });
  }
  const visible = messageEmojis.filter(
    ([emoji, label]) =>
      label.includes(search.trim()) || emoji.includes(search.trim()),
  );
  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-sky-50/80 via-surface to-violet-50/80 shadow-lg shadow-primary/5 dark:from-sky-950/25 dark:to-violet-950/20">
      <div className="relative overflow-hidden bg-gradient-to-l from-primary via-blue-600 to-violet-600 p-5 text-primary-foreground">
        <span className="absolute -start-8 -top-10 size-28 rounded-full bg-white/10" />
        <span className="absolute -bottom-14 end-20 size-32 rounded-full bg-white/10" />
        <h2 className="relative flex items-center gap-3 text-xl font-black">
          <span className="grid size-11 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25">
            <MessageCircleMore aria-hidden="true" className="size-6" />
          </span>
          پیام‌رسان داخلی
        </h2>
      </div>
      <div className="grid md:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-4 border-b border-primary/15 bg-gradient-to-b from-primary/10 via-sky-100/60 to-violet-100/50 p-4 dark:via-sky-950/20 dark:to-violet-950/20 md:border-b-0 md:border-e">
          <Input
            aria-label="جست‌وجوی واحد"
            placeholder="جست‌وجوی واحد…"
            value={unitSearch}
            onChange={(e) => setUnitSearch(e.target.value)}
          />
          <div className="grid gap-2">
            {messageUnits
              .filter((item) =>
                item.label
                  .toLowerCase()
                  .includes(unitSearch.trim().toLowerCase()),
              )
              .map((item) => (
                <Button
                  key={item.id}
                  variant={unitId === item.id ? 'primary' : 'ghost'}
                  aria-pressed={unitId === item.id}
                  className={`min-h-20 justify-start border text-base shadow-sm ${
                    unitId === item.id
                      ? 'border-primary shadow-primary/20'
                      : 'border-white/70 bg-surface/80 hover:border-primary/30 hover:bg-surface dark:border-white/10'
                  }`}
                  onClick={() => {
                    setUnitId(item.id);
                    setError('');
                  }}
                >
                  <span className="grid size-10 place-items-center rounded-xl bg-surface/25 ring-1 ring-current/10">
                    <MessageUnitIcon id={item.id} />
                  </span>
                  <span>
                    {item.label}
                    <span className="block text-xs font-normal opacity-75">
                      {item.id === 'ai' ? 'دستیار هوشمند' : 'گفت‌وگو با واحد'}
                    </span>
                  </span>
                </Button>
              ))}
          </div>
        </aside>
        <div className="min-w-0 space-y-5 p-5">
          <div className="flex items-center gap-3 rounded-2xl border border-primary/15 bg-surface/85 p-4 shadow-sm backdrop-blur">
            <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-primary/15 to-violet-500/15 text-primary">
              <MessageUnitIcon id={unit.id} />
            </span>
            <div>
              <p className="text-xs font-semibold text-primary">
                گفت‌وگو با واحد
              </p>
              <h3 className="text-lg font-black">{unit.label}</h3>
            </div>
          </div>
          <section
            aria-label={`قالب‌های پیام به ${unit.label}`}
            className="space-y-3 rounded-2xl border border-violet-200/70 bg-gradient-to-l from-violet-100/70 to-sky-100/70 p-4 dark:border-violet-800/60 dark:from-violet-950/30 dark:to-sky-950/30"
          >
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Sparkles
                aria-hidden="true"
                className="size-4 text-violet-600 dark:text-violet-300"
              />
              قالب‌های آماده برای {unit.label}
            </h3>
            <p className="text-xs text-muted-foreground">
              قالب به انتهای متن اضافه می‌شود؛ بخش‌های داخل کروشه را تکمیل و متن
              را ویرایش کنید.
            </p>
            <div className="flex flex-wrap gap-2">
              {unit.templates.map((template) => (
                <Button
                  key={template.title}
                  variant="outline"
                  className="border-primary/15 bg-surface/90 shadow-sm hover:border-primary/35 hover:bg-primary/10"
                  onClick={() => {
                    const next = text
                      ? `${text}\n\n${template.text}`
                      : template.text;
                    if (next.length > MESSAGE_DRAFT_LIMIT) {
                      setError(
                        'برای افزودن قالب، بخشی از متن پیام را کم کنید.',
                      );
                      return;
                    }
                    setText(next);
                    setError('');
                    selection.current = {
                      start: next.length,
                      end: next.length,
                    };
                    requestAnimationFrame(() => {
                      input.current?.focus();
                      input.current?.setSelectionRange(
                        next.length,
                        next.length,
                      );
                    });
                  }}
                >
                  {template.title}
                </Button>
              ))}
            </div>
          </section>
          <div className="space-y-2 rounded-2xl border border-sky-200/70 bg-surface/90 p-4 shadow-sm dark:border-sky-800/60">
            <label
              htmlFor="workbench-message-text"
              className="block text-sm font-semibold"
            >
              متن پیام
            </label>
            <Textarea
              ref={input}
              id="workbench-message-text"
              rows={5}
              maxLength={MESSAGE_DRAFT_LIMIT}
              value={text}
              placeholder="پیام خود را بنویسید…"
              onChange={(event) => {
                setText(event.target.value);
                setError('');
                rememberSelection();
              }}
              onSelect={rememberSelection}
              onBlur={rememberSelection}
              className="border-primary/15 bg-surface leading-8 shadow-inner"
              aria-describedby="workbench-message-count"
            />
            <p
              id="workbench-message-count"
              className="text-xs text-muted-foreground"
            >
              {text.length.toLocaleString('fa-IR')} از ۴٬۰۰۰
            </p>
          </div>
          <section
            className="space-y-3 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4"
            aria-label="پیوست‌های پیام"
          >
            <label
              className="flex items-center gap-2 text-sm font-semibold"
              htmlFor="workbench-message-files"
            >
              <Paperclip className="size-4" aria-hidden="true" />
              افزودن فایل پیوست
            </label>
            <Input
              id="workbench-message-files"
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(event) => {
                const picked = Array.from(event.target.files ?? []);
                event.target.value = '';
                if (
                  files.length + picked.length > 10 ||
                  picked.some(
                    (file) =>
                      file.size > 10 * 1024 * 1024 ||
                      !/\.(pdf|jpe?g|png|webp)$/i.test(file.name),
                  )
                ) {
                  setError(
                    'حداکثر ۱۰ فایل PDF یا تصویر و هر فایل تا ۱۰ مگابایت انتخاب کنید.',
                  );
                  return;
                }
                setAttachments((current) => ({
                  ...current,
                  [unitId]: [...files, ...picked],
                }));
                setError('');
              }}
            />
            <p className="text-xs text-muted-foreground">
              حداکثر ۱۰ فایل PDF یا تصویر، هر فایل تا ۱۰ مگابایت
            </p>
            <ul className="space-y-2">
              {files.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-primary/10 bg-surface p-2 text-sm shadow-sm"
                >
                  <span className="min-w-0 break-all">
                    {file.name} ·{' '}
                    {Math.ceil(file.size / 1024).toLocaleString('fa-IR')}{' '}
                    کیلوبایت
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`حذف پیوست ${file.name}`}
                    onClick={() =>
                      setAttachments((current) => ({
                        ...current,
                        [unitId]: files.filter(
                          (_, position) => position !== index,
                        ),
                      }))
                    }
                  >
                    <X className="size-4" aria-hidden="true" />
                    حذف
                  </Button>
                </li>
              ))}
            </ul>
          </section>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              aria-expanded={picker}
              aria-controls="workbench-emoji-picker"
              onClick={() => {
                setPicker((value) => !value);
                setSearch('');
              }}
            >
              <Smile className="size-5" aria-hidden="true" />
              افزودن ایموجی
            </Button>
            <Button disabled>
              <Send className="size-4" aria-hidden="true" />
              ارسال پیام
            </Button>
          </div>
          {picker && (
            <section
              id="workbench-emoji-picker"
              aria-label="انتخاب ایموجی"
              className="space-y-3 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-sky-50 p-3 shadow-sm dark:border-violet-800 dark:from-violet-950/30 dark:to-sky-950/30"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setPicker(false);
                  input.current?.focus();
                }
              }}
            >
              <div className="flex items-center gap-2">
                <Input
                  aria-label="جست‌وجوی ایموجی"
                  placeholder="جست‌وجوی ایموجی؛ مثل قلب یا تشکر"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <Button
                  variant="ghost"
                  aria-label="بستن انتخاب ایموجی"
                  onClick={() => setPicker(false)}
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {visible.map(([emoji, label]) => (
                  <button
                    type="button"
                    key={emoji}
                    title={label}
                    aria-label={`درج ایموجی ${label}`}
                    className="grid size-11 place-items-center rounded-lg border border-border bg-surface text-2xl hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => addEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              {!visible.length && (
                <p className="text-sm text-muted-foreground">
                  ایموجی پیدا نشد.
                </p>
              )}
            </section>
          )}
          {error && <Alert tone="error" title={error} />}
        </div>
      </div>
    </Card>
  );
}
