'use client';

import type { DocumentListItemV1, LoginResponse } from '@rubi/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FileText, RefreshCw, Star } from 'lucide-react';
import { Alert, Button, Card, EmptyState, Skeleton } from '@/components/ui';
import {
  DOCUMENT_FAVORITES_CHANGED,
  documentFavoritesKey,
  readDocumentFavorites,
} from '@/modules/documents/model/favorites';
import { loadFavoriteDocuments } from './favorites';

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
      const result = await loadFavoriteDocuments(
        readDocumentFavorites(user.id),
        () => request === generation.current,
      );
      if (request === generation.current) setItems(result);
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
  }, [user.id, canRead]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    const refresh = () => void load();
    const storage = (event: StorageEvent) => {
      if (event.key === null || event.key === documentFavoritesKey(user.id))
        refresh();
    };
    const visible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener(DOCUMENT_FAVORITES_CHANGED, refresh);
    window.addEventListener('storage', storage);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearTimeout(timer);
      invalidate();
      window.removeEventListener(DOCUMENT_FAVORITES_CHANGED, refresh);
      window.removeEventListener('storage', storage);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [load, user.id, invalidate]);
  if (!canRead)
    return (
      <EmptyState
        title="دسترسی به اسناد ندارید"
        description="مشاهده فایل‌های ستاره‌دار به دسترسی فعلی اسناد نیاز دارد."
      />
    );
  return (
    <div className="space-y-4">
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
        فایل‌هایی که در «اسناد و فایل‌ها» با این حساب و در همین مرورگر ستاره
        زده‌اید، اینجا هم نمایش داده می‌شوند. این فهرست هنوز بین دستگاه‌ها همگام
        نمی‌شود.
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
                <FileText aria-hidden="true" className="size-6 text-primary" />
                <div className="min-w-0 flex-1">
                  <h3 className="break-words font-semibold">{item.title}</h3>
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
    </div>
  );
}
