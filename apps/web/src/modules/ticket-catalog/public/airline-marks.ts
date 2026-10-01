import type { TicketLayoutAirline } from '@/components/travel/flight-ticket-layout';
const key = (value: string) =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replaceAll('ي', 'ی')
    .replaceAll('ك', 'ک')
    .replace(/[^\p{L}\p{N}]/gu, '');
export async function readTicketAirlineMarks(
  names: readonly string[],
  get: (path: string) => Promise<Response>,
): Promise<Record<string, TicketLayoutAirline>> {
  const marks: Record<string, TicketLayoutAirline> = {};
  await Promise.all(
    [...new Set(names)].map(async (name) => {
      try {
        const response = await get(
          '/master-data/airlines?' +
            new URLSearchParams({
              search: name,
              status: 'active',
              page: '1',
              pageSize: '25',
            }),
        );
        if (!response.ok) return;
        type Item = {
          name: string;
          code: string;
          attributes: { englishName?: string; logoFileReference?: string };
        };
        const matches = (item: Item) =>
          [item.name, item.code, item.attributes.englishName].some(
            (value) => typeof value === 'string' && key(value) === key(name),
          );
        let item = ((await response.json()) as { data: Item[] }).data?.find(
          matches,
        );
        if (!item) {
          const fallback = await get(
            '/master-data/airlines?status=active&page=1&pageSize=100',
          );
          if (fallback.ok)
            item = ((await fallback.json()) as { data: Item[] }).data?.find(
              matches,
            );
        }
        if (!item) return;
        marks[name] = { name: item.attributes.englishName || item.name };
        const id = item.attributes.logoFileReference;
        if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
        const logo = await get(`/documents/${id}/preview`);
        const mime = logo.headers.get('content-type')?.split(';')[0];
        if (
          !logo.ok ||
          !mime ||
          !['image/png', 'image/jpeg', 'image/webp'].includes(mime)
        )
          return;
        const bytes = new Uint8Array(await logo.arrayBuffer());
        if (!bytes.length || bytes.length > 5000000) return;
        let binary = '';
        for (let offset = 0; offset < bytes.length; offset += 8192)
          binary += String.fromCharCode(
            ...bytes.subarray(offset, offset + 8192),
          );
        marks[name]!.logoDataUrl = `data:${mime};base64,${btoa(binary)}`;
      } catch {
        /* Preserve the actual carrier name if its image is unavailable. */
      }
    }),
  );
  return marks;
}
