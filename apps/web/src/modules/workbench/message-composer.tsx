'use client';

import type {
  MessagingContactV1,
  MessagingConversationV1,
  MessagingMessageV1,
} from '@rubi/contracts';
import {
  Forward,
  MessageCircleMore,
  MessagesSquare,
  Paperclip,
  Send,
  Smile,
  Sparkles,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Alert,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  Input,
  Textarea,
} from '@/components/ui';
import {
  insertMessageEmoji,
  messageEmojis,
  MESSAGE_DRAFT_LIMIT,
} from './emoji';
import { MessageUnitIcon } from './message-unit-icon';
import { messagingApi, messagingRequestId } from './messaging-api';
import { messageUnits } from './message-templates';

type SidebarMode = 'conversations' | 'contacts';
const initials = (name: string) => name.trim().slice(0, 2) || 'ر';
const messageTime = (value: string) =>
  new Intl.DateTimeFormat('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));

export function MessageComposer({
  currentUserId,
  initialUnit = 'finance',
}: {
  currentUserId: string;
  initialUnit?: string;
}) {
  const [text, setText] = useState('');
  const [unitId, setUnitId] = useState<string>(
    messageUnits.some((item) => item.id === initialUnit)
      ? initialUnit
      : 'finance',
  );
  const unit = messageUnits.find((item) => item.id === unitId)!;
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('conversations');
  const [contacts, setContacts] = useState<MessagingContactV1[]>([]);
  const [conversations, setConversations] = useState<MessagingConversationV1[]>(
    [],
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = conversations.find((item) => item.id === activeId) ?? null;
  const [messages, setMessages] = useState<MessagingMessageV1[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [picker, setPicker] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState('');
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [forwarding, setForwarding] = useState<MessagingMessageV1 | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const input = useRef<HTMLTextAreaElement>(null);
  const selection = useRef({ start: 0, end: 0 });

  const reloadConversations = useCallback(
    async (selected?: string) => {
      const response = await messagingApi.conversations();
      setConversations(response.data);
      const next = selected ?? activeId;
      if (next && response.data.some((item) => item.id === next))
        setActiveId(next);
      else if (!next && response.data[0]) setActiveId(response.data[0].id);
    },
    [activeId],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([messagingApi.contacts(), messagingApi.conversations()])
      .then(([contactResponse, conversationResponse]) => {
        if (cancelled) return;
        setContacts(contactResponse.data);
        setConversations(conversationResponse.data);
        setActiveId(conversationResponse.data[0]?.id ?? null);
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : 'دریافت پیام‌رسان انجام نشد.',
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    messagingApi
      .messages(activeId)
      .then((response) => {
        if (!cancelled) setMessages(response.data);
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : 'دریافت پیام‌ها انجام نشد.',
          );
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      messagingApi
        .contacts(contactSearch)
        .then((response) => setContacts(response.data))
        .catch((reason: unknown) =>
          setError(
            reason instanceof Error
              ? reason.message
              : 'جست‌وجوی مخاطبان انجام نشد.',
          ),
        );
    }, 250);
    return () => clearTimeout(timer);
  }, [contactSearch]);

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
    if (!result)
      return setError(
        'ظرفیت متن پیام پر شده است. برای افزودن ایموجی، بخشی از متن را کم کنید.',
      );
    setText(result.text);
    setError('');
    setPicker(false);
    selection.current = { start: result.caret, end: result.caret };
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(result.caret, result.caret);
    });
  }

  async function openContact(contact: MessagingContactV1) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await messagingApi.createDirect({
        recipientId: contact.id,
        clientRequestId: messagingRequestId('direct'),
      });
      await reloadConversations(response.data.id);
      setSidebarMode('conversations');
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'شروع گفت‌وگو انجام نشد.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function createGroup() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await messagingApi.createGroup({
        title: groupTitle,
        memberIds: groupMembers,
        clientRequestId: messagingRequestId('group'),
      });
      await reloadConversations(response.data.id);
      setGroupOpen(false);
      setGroupTitle('');
      setGroupMembers([]);
      setSidebarMode('conversations');
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'ساخت گروه انجام نشد.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    if (!active || busy) return;
    if (attachments.length)
      return setError(
        'برای ارسال متن، فایل‌های انتخاب‌شده را حذف کنید؛ پیوست پیام در این نسخه ذخیره نمی‌شود.',
      );
    setBusy(true);
    setError('');
    try {
      const response = await messagingApi.send(active.id, {
        body: text,
        clientRequestId: messagingRequestId('message'),
      });
      setMessages((current) => [...current, response.data]);
      setText('');
      await reloadConversations(active.id);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'ارسال پیام انجام نشد.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function forwardMessage(destinationId: string) {
    if (!forwarding || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await messagingApi.forward(destinationId, {
        sourceMessageId: forwarding.id,
        clientRequestId: messagingRequestId('forward'),
      });
      if (destinationId === activeId)
        setMessages((current) => [...current, response.data]);
      setForwarding(null);
      await reloadConversations(destinationId);
      setActiveId(destinationId);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'فوروارد پیام انجام نشد.',
      );
    } finally {
      setBusy(false);
    }
  }

  const visibleEmojis = messageEmojis.filter(
    ([emoji, label]) =>
      label.includes(emojiSearch.trim()) || emoji.includes(emojiSearch.trim()),
  );
  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-sky-50/80 via-surface to-violet-50/80 shadow-lg shadow-primary/5 dark:from-sky-950/25 dark:to-violet-950/20">
      <div className="relative overflow-hidden bg-gradient-to-l from-primary via-blue-600 to-violet-600 p-5 text-primary-foreground">
        <span className="absolute -start-8 -top-10 size-28 rounded-full bg-white/10" />
        <h2 className="relative flex items-center gap-3 text-xl font-black">
          <span className="grid size-11 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25">
            <MessageCircleMore aria-hidden="true" className="size-6" />
          </span>
          پیام‌رسان داخلی
        </h2>
      </div>
      <div className="grid min-h-[680px] lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4 border-b border-primary/15 bg-gradient-to-b from-primary/10 via-sky-100/60 to-violet-100/50 p-4 dark:via-sky-950/20 dark:to-violet-950/20 lg:border-b-0 lg:border-e">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={sidebarMode === 'conversations' ? 'primary' : 'outline'}
              onClick={() => setSidebarMode('conversations')}
            >
              <MessagesSquare className="size-4" aria-hidden="true" />
              گفت‌وگوها
            </Button>
            <Button
              variant={sidebarMode === 'contacts' ? 'primary' : 'outline'}
              onClick={() => setSidebarMode('contacts')}
            >
              <Users className="size-4" aria-hidden="true" />
              مخاطبان
            </Button>
          </div>
          {sidebarMode === 'contacts' ? (
            <>
              <Input
                aria-label="جست‌وجوی مخاطب"
                placeholder="جست‌وجوی مخاطب…"
                value={contactSearch}
                onChange={(event) => setContactSearch(event.target.value)}
              />
              <Button
                className="w-full"
                variant="outline"
                onClick={() => setGroupOpen(true)}
                disabled={!contacts.length}
              >
                <UserPlus className="size-4" aria-hidden="true" />
                ایجاد گروه
              </Button>
              <div className="grid gap-2" aria-label="مخاطبان CRM">
                {contacts.map((contact) => (
                  <Button
                    key={contact.id}
                    variant="ghost"
                    className="h-auto justify-start border border-white/70 bg-surface/80 p-3 text-start dark:border-white/10"
                    onClick={() => void openContact(contact)}
                    disabled={busy}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 font-black text-primary">
                      {initials(contact.displayName)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-bold">
                        {contact.displayName}
                      </span>
                      <span className="block truncate text-xs font-normal opacity-70">
                        {contact.branches
                          .map((branch) => branch.name)
                          .join('، ')}
                      </span>
                    </span>
                  </Button>
                ))}
                {!loading && !contacts.length && (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    مخاطبی در شعب مجاز پیدا نشد.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="grid gap-2" aria-label="گفت‌وگوهای من">
              {conversations.map((conversation) => (
                <Button
                  key={conversation.id}
                  variant={activeId === conversation.id ? 'primary' : 'ghost'}
                  className="h-auto min-h-20 justify-start border border-white/70 p-3 text-start dark:border-white/10"
                  onClick={() => setActiveId(conversation.id)}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface/20">
                    <MessageCircleMore className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-bold">
                      {conversation.title}
                    </span>
                    <span className="block truncate text-xs font-normal opacity-75">
                      {conversation.lastMessage?.body ??
                        `${conversation.participants.length.toLocaleString('fa-IR')} عضو`}
                    </span>
                  </span>
                </Button>
              ))}
              {!loading && !conversations.length && (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  از بخش مخاطبان یک گفت‌وگو یا گروه بسازید.
                </p>
              )}
            </div>
          )}
        </aside>
        <main className="min-w-0 p-5">
          {!active ? (
            <div className="grid min-h-[560px] place-items-center">
              <EmptyState
                icon={Users}
                title="یک مخاطب انتخاب کنید"
                description="برای شروع پیام، مخاطبان را باز کنید یا یک گروه بسازید."
              />
            </div>
          ) : (
            <div className="space-y-5">
              <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/15 bg-surface/85 p-4 shadow-sm">
                <div>
                  <h3 className="text-lg font-black">{active.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {active.type === 'GROUP'
                      ? `${active.participants.length.toLocaleString('fa-IR')} عضو`
                      : active.participants
                          .map((item) => item.displayName)
                          .join('، ')}
                  </p>
                </div>
                {active.type === 'GROUP' && (
                  <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-200">
                    گروه
                  </span>
                )}
              </header>
              <section
                className="max-h-80 min-h-52 space-y-3 overflow-y-auto rounded-2xl border border-sky-200/70 bg-surface/80 p-4 dark:border-sky-800/60"
                aria-label="پیام‌های گفت‌وگو"
              >
                {messages.map((message) => {
                  const mine = message.sender.id === currentUserId;
                  return (
                    <article
                      key={message.id}
                      className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${mine ? 'me-auto bg-primary text-primary-foreground' : 'ms-auto bg-violet-100 text-violet-950 dark:bg-violet-950 dark:text-violet-50'}`}
                    >
                      <div className="flex items-center justify-between gap-4 text-xs opacity-80">
                        <strong>{message.sender.displayName}</strong>
                        <time>{messageTime(message.createdAt)}</time>
                      </div>
                      {message.forwardedFrom && (
                        <p className="mt-2 border-s-2 border-current/30 ps-2 text-xs opacity-80">
                          فوروارد از {message.forwardedFrom.senderDisplayName}
                        </p>
                      )}
                      <p className="mt-2 whitespace-pre-wrap break-words leading-7">
                        {message.body}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2 text-current hover:bg-white/15"
                        onClick={() => setForwarding(message)}
                      >
                        <Forward className="size-4" aria-hidden="true" />
                        فوروارد
                      </Button>
                    </article>
                  );
                })}
                {!messages.length && (
                  <p className="grid min-h-40 place-items-center text-sm text-muted-foreground">
                    اولین پیام این گفت‌وگو را بنویسید.
                  </p>
                )}
              </section>
              <div
                className="flex flex-wrap gap-2"
                aria-label="انتخاب قالب واحد"
              >
                {messageUnits.map((item) => (
                  <Button
                    key={item.id}
                    size="sm"
                    variant={unitId === item.id ? 'primary' : 'outline'}
                    onClick={() => setUnitId(item.id)}
                  >
                    <MessageUnitIcon id={item.id} />
                    {item.label}
                  </Button>
                ))}
              </div>
              <section
                aria-label={`قالب‌های پیام به ${unit.label}`}
                className="space-y-3 rounded-2xl border border-violet-200/70 bg-gradient-to-l from-violet-100/70 to-sky-100/70 p-4 dark:border-violet-800/60 dark:from-violet-950/30 dark:to-sky-950/30"
              >
                <h3 className="flex items-center gap-2 text-sm font-bold">
                  <Sparkles
                    aria-hidden="true"
                    className="size-4 text-violet-600"
                  />
                  قالب‌های آماده {unit.label}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {unit.templates.map((template) => (
                    <Button
                      key={template.title}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const next = text
                          ? `${text}\n\n${template.text}`
                          : template.text;
                        if (next.length > MESSAGE_DRAFT_LIMIT)
                          return setError(
                            'برای افزودن قالب، بخشی از متن پیام را کم کنید.',
                          );
                        setText(next);
                        setError('');
                      }}
                    >
                      {template.title}
                    </Button>
                  ))}
                </div>
              </section>
              <div className="space-y-2 rounded-2xl border border-primary/15 bg-surface/90 p-4 shadow-sm">
                <label
                  htmlFor="workbench-message-text"
                  className="block text-sm font-semibold"
                >
                  متن پیام
                </label>
                <Textarea
                  ref={input}
                  id="workbench-message-text"
                  rows={4}
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
                />
                <p className="text-xs text-muted-foreground">
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
                      attachments.length + picked.length > 10 ||
                      picked.some(
                        (file) =>
                          file.size > 10 * 1024 * 1024 ||
                          !/\.(pdf|jpe?g|png|webp)$/i.test(file.name),
                      )
                    )
                      return setError(
                        'حداکثر ۱۰ فایل PDF یا تصویر و هر فایل تا ۱۰ مگابایت انتخاب کنید.',
                      );
                    setAttachments((current) => [...current, ...picked]);
                  }}
                />
                {attachments.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between rounded-xl bg-surface p-2 text-sm"
                  >
                    <span className="truncate">{file.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setAttachments((current) =>
                          current.filter((_, position) => position !== index),
                        )
                      }
                    >
                      <X className="size-4" aria-hidden="true" />
                      حذف
                    </Button>
                  </div>
                ))}
              </section>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  aria-expanded={picker}
                  onClick={() => {
                    setPicker((value) => !value);
                    setEmojiSearch('');
                  }}
                >
                  <Smile className="size-5" aria-hidden="true" />
                  افزودن ایموجی
                </Button>
                <Button
                  disabled={busy || !text.trim()}
                  onClick={() => void sendMessage()}
                >
                  <Send className="size-4" aria-hidden="true" />
                  {busy ? 'در حال ثبت…' : 'ارسال پیام'}
                </Button>
              </div>
              {picker && (
                <section
                  aria-label="انتخاب ایموجی"
                  className="space-y-3 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-sky-50 p-3 dark:border-violet-800 dark:from-violet-950/30 dark:to-sky-950/30"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label="جست‌وجوی ایموجی"
                      placeholder="جست‌وجوی ایموجی"
                      value={emojiSearch}
                      onChange={(event) => setEmojiSearch(event.target.value)}
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
                    {visibleEmojis.map(([emoji, label]) => (
                      <button
                        type="button"
                        key={emoji}
                        title={label}
                        aria-label={`درج ایموجی ${label}`}
                        className="grid size-11 place-items-center rounded-lg border border-border bg-surface text-2xl"
                        onClick={() => addEmoji(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
          {error && (
            <div className="mt-4">
              <Alert tone="error" title={error} />
            </div>
          )}
        </main>
      </div>
      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
        <DialogContent dir="rtl" className="max-w-xl">
          <DialogTitle>ایجاد گروه جدید</DialogTitle>
          <DialogDescription>
            نام گروه را بنویسید و کاربران CRM دارای شعبه مشترک را انتخاب کنید.
          </DialogDescription>
          <label className="mt-4 block space-y-2 text-sm font-semibold">
            نام گروه
            <Input
              value={groupTitle}
              maxLength={160}
              onChange={(event) => setGroupTitle(event.target.value)}
              placeholder="مثلاً پیگیری پرونده تور"
            />
          </label>
          <div
            className="mt-4 max-h-72 space-y-2 overflow-y-auto rounded-xl border border-border p-3"
            aria-label="انتخاب اعضای گروه"
          >
            {contacts.map((contact) => (
              <label
                key={contact.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl p-2 hover:bg-muted"
              >
                <Checkbox
                  checked={groupMembers.includes(contact.id)}
                  onCheckedChange={(checked) =>
                    setGroupMembers((current) =>
                      checked
                        ? [...current, contact.id]
                        : current.filter((id) => id !== contact.id),
                    )
                  }
                />
                <span>
                  <strong className="block">{contact.displayName}</strong>
                  <span className="text-xs text-muted-foreground">
                    {contact.branches.map((branch) => branch.name).join('، ')}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <Button
            className="mt-4"
            disabled={
              busy || groupTitle.trim().length < 2 || !groupMembers.length
            }
            onClick={() => void createGroup()}
          >
            <UserPlus className="size-4" aria-hidden="true" />
            ایجاد گروه
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(forwarding)}
        onOpenChange={(open) => {
          if (!open) setForwarding(null);
        }}
      >
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogTitle>فوروارد پیام</DialogTitle>
          <DialogDescription>
            گفت‌وگوی مقصد را انتخاب کنید. متن پیام از نسخه ثبت‌شده روی سرور کپی
            می‌شود.
          </DialogDescription>
          <div className="mt-4 grid max-h-80 gap-2 overflow-y-auto">
            {conversations.map((conversation) => (
              <Button
                key={conversation.id}
                variant="outline"
                className="h-auto justify-start p-3"
                disabled={busy}
                onClick={() => void forwardMessage(conversation.id)}
              >
                <Forward className="size-4" aria-hidden="true" />
                {conversation.title}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
