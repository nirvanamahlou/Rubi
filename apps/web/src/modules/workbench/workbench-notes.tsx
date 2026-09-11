'use client';
import { WorkbenchSelect } from './workbench-select';

import { useState } from 'react';
import { LockKeyhole, Plus, Search, Star, StickyNote } from 'lucide-react';
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
  const shown = filterNoteDrafts(notes, search, folder, from, to);
  function edit(note: NoteDraft) {
    setEditing(note);
    setEditorVersion((v) => v + 1);
    onOpenChange(true);
  }
  function update(id: string, change: Partial<NoteDraft>) {
    setNotes((current) =>
      current.map((note) => (note.id === id ? { ...note, ...change } : note)),
    );
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
      <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        <LockKeyhole className="size-4 shrink-0" />
        <span>
          پیش‌نویس خصوصی این صفحه؛ نمونه‌ها و تغییرات در حساب ذخیره نمی‌شوند و
          با بارگذاری مجدد از بین می‌روند.
        </span>
      </div>
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
            <span className="sr-only">از تاریخ پیش‌نویس</span>
            <DatePicker
              value={from}
              onChange={setFrom}
              placeholder="از تاریخ پیش‌نویس"
            />
          </label>
          <label>
            <span className="sr-only">تا تاریخ پیش‌نویس</span>
            <DatePicker
              value={to}
              onChange={setTo}
              placeholder="تا تاریخ پیش‌نویس"
            />
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
                        update(note.id, {
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
                    ? 'قالب نمونه'
                    : `پیش‌نویس ذخیره‌نشده${note.updatedAt ? ' • ' + new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short' }).format(new Date(note.updatedAt)) : ''}`}
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
                    onClick={() => update(note.id, { pinned: !note.pinned })}
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
            <span>کارت از این پیش‌نویس حذف شد.</span>
            <Button
              variant="ghost"
              onClick={() => {
                setNotes((current) => [...current, removed]);
                setRemoved(undefined);
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
        onApply={(draft) => {
          setNotes((current) =>
            editing
              ? current.map((note) =>
                  note.id === editing.id ? { ...draft, id: editing.id } : note,
                )
              : [...current, draft],
          );
          closeEditor(false);
        }}
      />
      <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogTitle>پوشه جدید</DialogTitle>
          <DialogDescription>
            این پوشه فقط در پیش‌نویس همین صفحه ایجاد می‌شود.
          </DialogDescription>
          <form
            className="mt-4 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const name = folderName.trim();
              if (!name || folders.includes(name)) return;
              setFolders((current) => [...current, name]);
              setFolderName('');
              setFolderOpen(false);
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
