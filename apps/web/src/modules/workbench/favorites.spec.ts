import type { DocumentListItemV1 } from '@rubi/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  documentFavoritesKey,
  parseDocumentFavorites,
  readDocumentFavorites,
} from '@/modules/documents/model/favorites';
import { loadFavoriteDocuments } from './favorites';
const item = (id: string) => ({ id }) as DocumentListItemV1;
const page = (ids: string[], number = 1, totalPages = 1) => ({
  data: ids.map(item),
  meta: { page: number, pageSize: 100, total: totalPages * 100, totalPages },
});
describe('shared Documents favorites consumer', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('reads only the current account key without writing browser data', () => {
    const getItem = vi.fn().mockReturnValue('["document-1"]');
    vi.stubGlobal('window', { localStorage: { getItem } });
    expect([...readDocumentFavorites('user-a')]).toEqual(['document-1']);
    expect(getItem).toHaveBeenCalledExactlyOnceWith(
      documentFavoritesKey('user-a'),
    );
  });
  it('deduplicates IDs and rejects embedded record data', () => {
    expect([
      ...parseDocumentFavorites(
        '["a","a",null,4,{"id":"b","title":"private"},""]',
      ),
    ]).toEqual(['a']);
    expect(() => parseDocumentFavorites('broken')).toThrow();
  });
  it('finds stars beyond the first100documents and returns only authorized records', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce(page(['unstarred'], 1, 2))
      .mockResolvedValueOnce(page(['starred'], 2, 2));
    const result = await loadFavoriteDocuments(
      new Set(['starred', 'revoked']),
      () => true,
      list,
    );
    expect(result.map((value) => value.id)).toEqual(['starred']);
    expect(list).toHaveBeenNthCalledWith(2, {
      page: 2,
      pageSize: 100,
      sortBy: 'archiveCode',
      sortDirection: 'asc',
    });
  });
  it('does not request the archive for an empty favorites set', async () => {
    const list = vi.fn();
    expect(await loadFavoriteDocuments(new Set(), () => true, list)).toEqual(
      [],
    );
    expect(list).not.toHaveBeenCalled();
  });
  it('stops once all favorites are resolved', async () => {
    const list = vi.fn().mockResolvedValue(page(['a'], 1, 20));
    expect(
      await loadFavoriteDocuments(new Set(['a']), () => true, list),
    ).toEqual([item('a')]);
    expect(list).toHaveBeenCalledOnce();
  });
  it('does not return partial or cached metadata after a server failure', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce(page(['a'], 1, 2))
      .mockRejectedValueOnce(new Error('forbidden'));
    await expect(
      loadFavoriteDocuments(new Set(['a', 'b']), () => true, list),
    ).rejects.toThrow('forbidden');
  });
  it('discards an in-flight response after the current account/view changes', async () => {
    let current = true;
    const list = vi.fn().mockImplementation(async () => {
      current = false;
      return page(['a']);
    });
    await expect(
      loadFavoriteDocuments(new Set(['a']), () => current, list),
    ).rejects.toThrow('Superseded');
  });
});
