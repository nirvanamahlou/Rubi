'use client';

import type {
  DocumentListItemV1,
  LoginResponse,
  WorkbenchNoteV1,
} from '@nora/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FileText, RefreshCw, Star, StickyNote } from 'lucide-react';
import { Alert, Button, Card, EmptyState, Skeleton } from '@/components/ui';
import { DOCUMENT_FAVORITES_CHANGED } from '@/modules/documents/model/favorites';
import { documentsApi } from '@/modules/documents/api/client';
import { workbenchPersonalApi } from './workbench-personal-api';
import { WORKBENCH_NOTE_FAVORITES_CHANGED } from './note-drafts';

function StarredNotes() {
  const [notes, setNotes] = useState<WorkbenchNoteV1[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const response = await workbenchPersonalApi.notes();
      if (request === generation.current)
        setNotes(response.data.filter((note) => note.pinned));
    } catch (reason) {
      if (request === generation.current)
        setError(
          reason instanceof Error
            ? reason.message
            : 'دریافت یادداشت‌های ستاره‌دار انجام نشد.',
        );
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    const refresh = () => void load();
    window.addEventListener(WORKBENCH_NOTE_FAVORITES_CHANGED, refresh);
    return () => {
      window.clearTimeout(timer);
      invalidate();
      window.removeEventListener(WORKBENCH_NOTE_FAVORITES_CHANGED, refresh);
    };
  }, [load, invalidate]);
  return (
    <section className="space-y-3" aria-label="یادداشت‌های ستاره‌دار من">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-bold">
          <StickyNote aria-hidden="true" className="size-5" />
          یادداشت‌های ستاره‌دار من
        </h2>
        <Button asChild variant="outline" size="sm">
          <Link href="/workbench?tab=notes">همه یادداشت‌ها</Link>
        </Button>
      </div>
      {loading ? (
        <Skeleton className="h-24" />
      ) : error ? (
        <Alert
          tone="error"
          title="یادداشت‌های ستاره‌دار دریافت نشدند"
          description={error}
        />
      ) : !notes.length ? (
        <Card>
          <EmptyState
            icon={Star}
            title="یادداشت ستاره‌دار ندارید"
            description="در دفتر یادداشت، ستاره کنار یادداشت ذخیره‌شده را بزنید."
          />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {notes.map((note) => (
              <li
                key={note.id}
                className="flex flex-wrap items-center gap-3 p-4"
              >
                <Star
                  aria-label="ستاره‌دار"
                  className="size-4 fill-amber-400 text-amber-600"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="break-words font-semibold">{note.title}</h3>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                    {note.body ||
                      note.items.map((item) => item.text).join('، ')}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/workbench?tab=notes">مشاهده یادداشت</Link>
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

export function WorkbenchFavorites({ user }: { user: LoginResponse['user'] }) {
  const [items, setItems] = useState<DocumentListItemV1[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const canRead = user.permissions.includes('documents.metadata.read');
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setItems([]);
    setError('');
    setLoading(true);
    try {
      if (!canRead) return;
      const result = await documentsApi.favorites();
      if (request === generation.current) setItems(result.data);
    } catch (reason) {
      if (request === generation.current)
        setError(
          reason instanceof Error
            ? reason.message
            : 'دریافت ستاره‌دارها انجام نشد.',
        );
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [canRead]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    const refresh = () => void load();
    const visible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener(DOCUMENT_FAVORITES_CHANGED, refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearTimeout(timer);
      invalidate();
      window.removeEventListener(DOCUMENT_FAVORITES_CHANGED, refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [load, invalidate]);
  return (
    <div className="space-y-4">
      <StarredNotes />
      {canRead ? (
        <section className="space-y-4" aria-label="اسناد ستاره‌دار من">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold">اسناد ستاره‌دار من</h2>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={loading}
                onClick={() => void load()}
              >
                <RefreshCw aria-hidden="true" className="size-4" />
                به‌روزرسانی فهرست
              </Button>
              <Button asChild variant="outline">
                <Link href="/documents">اسناد و فایل‌ها</Link>
              </Button>
            </div>
          </div>
          <p className="text-sm leading-7 text-muted-foreground">
            فایل‌هایی که در «اسناد و فایل‌ها» با این حساب ستاره زده‌اید، اینجا و
            در همه دستگاه‌های شما همگام نمایش داده می‌شوند.
          </p>
          {loading ? (
            <Skeleton className="h-48" />
          ) : error ? (
            <Alert
              tone="error"
              title="ستاره‌دارها دریافت نشدند"
              description={error}
            />
          ) : !items.length ? (
            <Card>
              <EmptyState
                icon={Star}
                title="سند ستاره‌دار قابل‌دسترسی ندارید"
                description="در بخش اسناد و فایل‌ها، ستاره کنار فایل موردنظر را بزنید. فایل حذف‌شده یا خارج از دسترسی شما نمایش داده نمی‌شود."
              />
            </Card>
          ) : (
            <Card>
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-3 p-4"
                  >
                    <FileText
                      aria-hidden="true"
                      className="size-6 text-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="break-words font-semibold">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.archiveCode} · {item.type.name}
                      </p>
                    </div>
                    <Star
                      aria-label="ستاره‌دار"
                      className="size-4 fill-amber-400 text-amber-600"
                    />
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={`/documents?document=${encodeURIComponent(item.id)}`}
                      >
                        مشاهده و دریافت
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      ) : null}
    </div>
  );
}
