import type { MasterDataRecord } from '@nora/contracts';
import type { ReservationFormReferences } from './reservation-form';
/** Shared public-directory lookup for browser preview and PDF. */
export async function loadOutputReferences(
  read: (path: string) => Promise<unknown>,
  requestId: string,
) {
  const refs: ReservationFormReferences = {};
  for (const resource of ['airlines', 'brokers']) {
    for (let page = 1; page <= 100; page++) {
      const path =
        resource === 'brokers'
          ? '/reservations/requests/' +
            encodeURIComponent(requestId) +
            '/voucher-brokers?page=' +
            page
          : '/master-data/airlines?page=' + page + '&pageSize=100';
      let raw: unknown;
      try {
        raw = await read(path);
      } catch {
        break;
      }
      const response = raw as {
        data?: {
          id: string;
          name: string;
          englishName?: string;
          attributes?: Record<string, unknown>;
        }[];
        meta?: { total?: number };
      };
      const rows = Array.isArray(response?.data) ? response.data : [];
      for (const r of rows)
        refs[resource + ':' + r.id] = {
          ...r,
          attributes: {
            ...r.attributes,
            ...(r.englishName ? { englishName: r.englishName } : {}),
          },
        } as MasterDataRecord;
      if (
        !rows.length ||
        !response.meta?.total ||
        Object.keys(refs).filter((k) => k.startsWith(resource + ':')).length >=
          response.meta.total
      )
        break;
    }
  }
  return refs;
}
