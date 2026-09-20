'use client';
import { WorkbenchSelect } from './workbench-select';

import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Search, Star, StickyNote } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Input,
} from '@/components/ui';
import { DatePicker } from '@/components/ui/date-picker';
import { NoteEditor } from './note-editor';
import { filterNoteDrafts, noteTemplates, type NoteDraft } from './note-drafts';
import { workbenchPersonalApi } from './workbench-personal-api';

function noteInput(note: NoteDraft) {
  return {
    title: note.title,
    body: note.body,
    folder: note.folder,
    tags: note.tags,
    items: note.items,
    pinned: note.pinned,
    reminderAt: note.reminderAt ?? null,
    ...(note.version ? { expectedVersion: note.version } : {}),
  };
}

function storedNote(
  note: Awaited<ReturnType<typeof workbenchPersonalApi.createNote>>['data'],
): NoteDraft {
  return { ...note, template: false };
}

export function WorkbenchNotes({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [notes, setNotes] = useState<NoteDraft[]>(() =>
    structuredClone(noteTemplates),
  );
  const [folders, setFolders] = useState(['شخصی', 'جلسات', 'ایده‌ها']);
  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [editing, setEditing] = useState<NoteDraft>();
  const [editorVersion, setEditorVersion] = useState(0);
  const [removed, setRemoved] = useState<NoteDraft>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await workbenchPersonalApi.notes();
      setNotes([
        ...structuredClone(noteTemplates),
        ...response.data.map(storedNote),
      ]);
      setFolders(response.folders);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'دریافت یادداشت‌ها انجام نشد.',
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const shown = filterNoteDrafts(notes, search, folder, from, to);
  function edit(note: NoteDraft) {
    setEditing(note);
    setEditorVersion((v) => v + 1);
    onOpenChange(true);
  }
  async function update(id: string, change: Partial<NoteDraft>) {
    const previous = notes.find((note) => note.id === id);
    if (!previous) return;
    const next = { ...previous, ...change };
    setNotes((current) =>
      current.map((note) => (note.id === id ? { ...note, ...change } : note)),
    );
    if (previous.template) return;
    try {
      const response = await workbenchPersonalApi.updateNote(
        id,
        noteInput(next),
      );
      setNotes((current) =>
        current.map((note) =>
          note.id === id ? storedNote(response.data) : note,
        ),
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'ذخیره یادداشت انجام نشد.',
      );
      await load();
    }
  }
  function closeEditor(value: boolean) {
    onOpenChange(value);
    if (!value) {
      setEditing(undefined);
      setEditorVersion((v) => v + 1);
    }
  }
  return (
    <div className="space-y-4">
      {error ? (
        <Alert
          tone="error"
          title="عملیات یادداشت انجام نشد"
          description={error}
        />
      ) : null}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <StickyNote className="size-5" />
            دفتر یادداشت من
          </h2>
          <Button variant="outline" onClick={() => setFolderOpen(true)}>
            <Plus className="size-4" />
            پوشه جدید
          </Button>
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw className="size-4" />
            به‌روزرسانی
          </Button>
        </div>
        <div className="grid gap-3 border-b border-border p-4 lg:grid-cols-[minmax(0,1fr)_170px_170px_140px]">
          <label className="relative">
            <span className="sr-only">جست‌وجوی یادداشت</span>
            <Input
              className="pe-10"
              placeholder="جست‌وجو در عنوان، متن یا برچسب…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search
              className="absolute end-3 top-3 size-4 text-muted-foreground"
              aria-hidden="true"
            />
          </label>
          <label>
            <span className="sr-only">از تاریخ</span>
            <DatePicker
              value={from}
              onChange={setFrom}
              placeholder="از تاریخ"
            />
          </label>
          <label>
            <span className="sr-only">تا تاریخ</span>
            <DatePicker value={to} onChange={setTo} placeholder="تا تاریخ" />
          </label>
          <WorkbenchSelect
            label="پوشه یادداشت"
            value={folder}
            onValueChange={setFolder}
            options={[
              { value: '', label: 'همه پوشه‌ها' },
              ...folders.map((name) => ({ value: name, label: name })),
            ]}
          />
        </div>
        {(search || folder || from || to) && (
          <div className="px-4 pt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setFolder('');
                setFrom('');
                setTo('');
              }}
            >
              پاک‌کردن فیلترها
            </Button>
          </div>
        )}
        {from && to && from > to && (
          <div className="px-4 pt-3">
            <Alert
              tone="error"
              title="تاریخ پایان باید بعد از تاریخ شروع باشد"
            />
          </div>
        )}
        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((note) => (
            <article
              key={note.id}
              className="flex min-h-72 flex-col rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-surface p-5 dark:border-amber-800 dark:from-amber-950/30"
              aria-label={note.title}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-md bg-amber-100/70 px-2 py-1 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                  • {note.folder}
                </span>
                {note.pinned && (
                  <Star
                    className="size-5 text-primary"
                    aria-label="سنجاق‌شده"
                  />
                )}
              </div>
              <h3 className="mt-5 text-base font-bold">{note.title}</h3>
              {note.body && (
                <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-8 text-muted-foreground">
                  {note.body}
                </p>
              )}
              <div className="mt-3 space-y-2">
                {note.items.map((item, index) => (
                  <label
                    key={index}
                    className="flex items-start gap-2 text-sm leading-7"
                  >
                    <input
                      type="checkbox"
                      className="mt-1.5 size-4 shrink-0 accent-primary"
                      checked={item.done}
                      onChange={(e) =>
                        void update(note.id, {
                          items: note.items.map((row, i) =>
                            i === index
                              ? { ...row, done: e.target.checked }
                              : row,
                          ),
                        })
                      }
                    />
                    <span
                      className={
                        item.done ? 'line-through text-muted-foreground' : ''
                      }
                    >
                      {item.text}
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-auto pt-6">
                <p className="text-xs text-muted-foreground">
                  {note.tags} {note.tags ? '• ' : ''}
                  {note.template
                    ? 'قالب آماده'
                    : `ذخیره‌شده${note.updatedAt ? ' • ' + new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short' }).format(new Date(note.updatedAt)) : ''}`}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => edit(note)}
                  >
                    ویرایش
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    aria-pressed={note.pinned}
                    onClick={() =>
                      void update(note.id, { pinned: !note.pinned })
                    }
                  >
                    {note.pinned ? 'برداشتن سنجاق' : 'سنجاق'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-rose-200 text-rose-700 dark:text-rose-300"
                    onClick={() => {
                      setRemoved(note);
                      setNotes((current) =>
                        current.filter((row) => row.id !== note.id),
                      );
                      if (!note.template)
                        void workbenchPersonalApi
                          .deleteNote(note.id)
                          .catch((reason) => {
                            setError(
                              reason instanceof Error
                                ? reason.message
                                : 'حذف یادداشت انجام نشد.',
                            );
                            void load();
                          });
                    }}
                  >
                    حذف
                  </Button>
                </div>
              </div>
            </article>
          ))}
          {!shown.length && (
            <p className="col-span-full py-12 text-center text-muted-foreground">
              یادداشتی برای نمایش نیست.
            </p>
          )}
        </div>
        {removed && (
          <div className="flex items-center justify-between border-t border-border p-4 text-sm">
            <span>یادداشت حذف شد.</span>
            <Button
              variant="ghost"
              onClick={() => {
                const candidate = removed;
                setRemoved(undefined);
                if (candidate.template) {
                  setNotes((current) => [...current, candidate]);
                  return;
                }
                void workbenchPersonalApi
                  .createNote(noteInput(candidate))
                  .then((response) =>
                    setNotes((current) => [
                      ...current,
                      storedNote(response.data),
                    ]),
                  )
                  .catch((reason) => {
                    setError(
                      reason instanceof Error
                        ? reason.message
                        : 'بازگردانی یادداشت انجام نشد.',
                    );
                    setRemoved(candidate);
                  });
              }}
            >
              بازگردانی
            </Button>
          </div>
        )}
      </Card>
      <NoteEditor
        key={editorVersion}
        open={open}
        onOpenChange={closeEditor}
        initial={editing}
        folders={folders}
        onApply={async (draft) => {
          setError('');
          try {
            if (editing && !editing.template) {
              const response = await workbenchPersonalApi.updateNote(
                editing.id,
                {
                  ...noteInput(draft),
                  ...(editing.version
                    ? { expectedVersion: editing.version }
                    : {}),
                },
              );
              setNotes((current) =>
                current.map((note) =>
                  note.id === editing.id ? storedNote(response.data) : note,
                ),
              );
            } else {
              const response = await workbenchPersonalApi.createNote(
                noteInput(draft),
              );
              setNotes((current) => [...current, storedNote(response.data)]);
            }
            closeEditor(false);
          } catch (reason) {
            setError(
              reason instanceof Error
                ? reason.message
                : 'ذخیره یادداشت انجام نشد.',
            );
          }
        }}
      />
      <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogTitle>پوشه جدید</DialogTitle>
          <DialogDescription>پوشه در حساب شما ذخیره می‌شود.</DialogDescription>
          <form
            className="mt-4 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const name = folderName.trim();
              if (!name || folders.includes(name)) return;
              void workbenchPersonalApi
                .createFolder(name)
                .then(() => {
                  setFolders((current) => [...current, name]);
                  setFolderName('');
                  setFolderOpen(false);
                })
                .catch((reason) =>
                  setError(
                    reason instanceof Error
                      ? reason.message
                      : 'ذخیره پوشه انجام نشد.',
                  ),
                );
            }}
          >
            <Input
              aria-label="نام پوشه"
              required
              maxLength={60}
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
            />
            <Button
              type="submit"
              disabled={
                !folderName.trim() || folders.includes(folderName.trim())
              }
            >
              افزودن پوشه
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
