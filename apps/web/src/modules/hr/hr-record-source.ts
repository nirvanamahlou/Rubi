import type { HrRecordDto } from '@rubi/contracts';
import { sectionTabs, type HrSectionId } from './hr.model';
import { hrGroups, type HrSource } from './hr-navigation';

const sources = new Map(
  Object.values(hrGroups)
    .flatMap((groups) => groups.flatMap((group) => group.sources))
    .map((source) => [`${source.section}.${source.tab}`, source]),
);

// Keep navigation metadata independent of the operation screen's client bundle.
export function sourceForRecord(record: HrRecordDto): HrSource {
  return (
    sources.get(`${record.section}.${record.tab}`) ?? {
      section: record.section as HrSectionId,
      tab: record.tab,
      label:
        sectionTabs[record.section as HrSectionId]?.find(
          (tab) => tab.id === record.tab,
        )?.label ?? 'پرونده',
      action: 'افزودن',
    }
  );
}
