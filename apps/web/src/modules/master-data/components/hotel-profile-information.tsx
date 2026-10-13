import type { MasterDataRecord } from '@nora/contracts';
import { hotelProfileFields } from '../model/hotel-profile-fields';
import {
  MasterDataDetailItem,
  MasterDataDetailSection,
} from './master-data-profile-details';

export function HotelProfileInformation({
  record,
}: {
  record: MasterDataRecord;
}) {
  return (
    <MasterDataDetailSection title="اطلاعات تکمیلی هتل">
      {hotelProfileFields.map((field) => {
        const raw = record.attributes[field.key];
        const value =
          raw === null || raw === undefined || raw === ''
            ? '—'
            : field.key === 'sourceFeatured'
              ? String(raw) === 'true'
                ? 'بله'
                : 'خیر'
              : String(raw);
        return (
          <MasterDataDetailItem
            key={field.key}
            label={field.label}
            value={
              <span className="whitespace-pre-wrap break-words">{value}</span>
            }
          />
        );
      })}
    </MasterDataDetailSection>
  );
}
