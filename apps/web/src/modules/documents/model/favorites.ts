/** Read-only compatibility with the existing Documents favorites. No new storage. */
export const DOCUMENT_FAVORITES_CHANGED = 'rubi:documents:favorites-changed';
export const documentFavoritesKey = (userId: string) =>
  `rubi.documents.favorites.${userId}`;
export function parseDocumentFavorites(stored: string | null): Set<string> {
  if (!stored) return new Set();
  const values: unknown = JSON.parse(stored);
  if (!Array.isArray(values))
    throw new Error('فهرست ستاره‌دارهای اسناد قابل خواندن نیست.');
  return new Set(
    values.filter(
      (value): value is string =>
        typeof value === 'string' && value.length > 0 && value.length <= 128,
    ),
  );
}
export function readDocumentFavorites(userId: string): Set<string> {
  if (!userId || typeof window === 'undefined') return new Set();
  return parseDocumentFavorites(
    window.localStorage.getItem(documentFavoritesKey(userId)),
  );
}
