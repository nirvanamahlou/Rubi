'use client';

import { useRef, useState } from 'react';
import { Send, Smile, X, Paperclip } from 'lucide-react';
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
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border p-5">
        <h2 className="text-lg font-bold">پیام‌رسان داخلی</h2>
        <span className="text-xs text-muted-foreground">
          خواندن پیام به معنی پذیرش مسئولیت نیست
        </span>
      </div>
      <div className="grid md:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-4 border-b border-border bg-primary/5 p-4 md:border-b-0 md:border-e">
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
                  className="min-h-20 justify-start text-base"
                  onClick={() => {
                    setUnitId(item.id);
                    setError('');
                  }}
                >
                  <span className="grid size-10 place-items-center rounded-xl bg-surface/20">
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
        <div className="min-w-0 space-y-4 p-5">
          <h3 className="flex items-center gap-2 border-b border-border pb-4 text-lg font-bold">
            <MessageUnitIcon id={unit.id} />
            {unit.label}
          </h3>
          <Alert
            tone="info"
            title="ارسال پیام هنوز فعال نیست"
            description="می‌توانید متن و ایموجی را آماده کنید؛ این متن ارسال یا ذخیره نمی‌شود و با خروج از این بخش از بین می‌رود."
          />
          <div className="grid min-h-36 place-items-center rounded-xl bg-muted/30 p-5 text-sm text-muted-foreground">
            تاریخچهٔ پیام‌ها پس از اتصال سرویس گفت‌وگو نمایش داده می‌شود.
          </div>
          <section
            aria-label={`قالب‌های پیام به ${unit.label}`}
            className="space-y-3 rounded-xl border border-border bg-muted/40 p-4"
          >
            <h3 className="text-sm font-semibold">
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
            {unit.id === 'ai' && (
              <p className="text-xs text-muted-foreground">
                پاسخ‌گویی AI هنوز متصل نیست؛ این قالب‌ها برای آماده‌سازی متن
                هستند.
              </p>
            )}
          </section>
          <div className="space-y-2">
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
              className="leading-8"
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
            className="space-y-3 rounded-xl border border-border p-4"
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
              فایل‌ها فقط برای پیش‌نویس انتخاب می‌شوند؛ هنوز بارگذاری یا ارسال
              نشده‌اند. برای تعویض، فایل را حذف و فایل جدید انتخاب کنید.
            </p>
            <ul className="space-y-2">
              {files.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 p-2 text-sm"
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
            <Button disabled aria-describedby="workbench-message-send-status">
              <Send className="size-4" aria-hidden="true" />
              ارسال پیام
            </Button>
            <span
              id="workbench-message-send-status"
              className="text-xs text-muted-foreground"
            >
              ارسال در دسترس نیست.
            </span>
          </div>
          {picker && (
            <section
              id="workbench-emoji-picker"
              aria-label="انتخاب ایموجی"
              className="space-y-3 rounded-xl border border-border bg-muted/40 p-3"
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
