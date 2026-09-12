import type { DocumentListItemV1 } from '@rubi/contracts';
import { documentsApi } from '@/modules/documents/api/client';

/** Only public list results are eligible; a stored ID never grants access. */
export async function loadFavoriteDocuments(
  ids: ReadonlySet<string>,
  isCurrent: () => boolean = () => true,
  list = documentsApi.list,
): Promise<DocumentListItemV1[]> {
  if (!ids.size) return [];
  const found = new Map<string, DocumentListItemV1>();
  let page = 1;
  let totalPages = 1;
  do {
    if (!isCurrent()) throw new Error('Superseded favorites request');
    const response = await list({
      page,
      pageSize: 100,
      sortBy: 'archiveCode',
      sortDirection: 'asc',
    });
    if (!isCurrent()) throw new Error('Superseded favorites request');
    for (const item of response.data)
      if (ids.has(item.id)) found.set(item.id, item);
    totalPages = response.meta.totalPages;
    page++;
  } while (page <= totalPages && found.size < ids.size);
  return [...found.values()];
}
