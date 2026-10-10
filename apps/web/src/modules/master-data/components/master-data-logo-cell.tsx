import type { MasterDataRecord } from '@nora/contracts';

import { MasterDataLogoImage } from './master-data-logo-image';

export function MasterDataLogoCell({
  record,
  asCell = true,
}: {
  record: MasterDataRecord;
  asCell?: boolean;
}) {
  const hasLogo = Boolean(
    String(record.attributes.logoFileReference ?? '').trim(),
  );
  const logo = (
    <div
      aria-label={
        hasLogo ? `لوگوی ${record.name}` : `بدون لوگو: ${record.name}`
      }
      className="flex size-10 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/50 text-sm font-black text-muted-foreground"
    >
      {hasLogo ? (
        <MasterDataLogoImage className="size-10 border-0" record={record} />
      ) : (
        <span aria-hidden="true">{record.name.trim().charAt(0) || '—'}</span>
      )}
    </div>
  );
  return asCell ? <td className="p-4">{logo}</td> : logo;
}
