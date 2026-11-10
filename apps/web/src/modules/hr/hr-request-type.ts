import type { HrRecordDto } from '@nora/contracts';

export function matchesHrRequestType(record: HrRecordDto, type: string) {
  if (!type) return true;
  const key = `${record.section}.${record.tab}`;
  const subtype = record.data.requestSubtype ?? '';
  if (type === 'leave')
    return (
      ['time.leave', 'requests.leave', 'requests.radanLeave'].includes(key) ||
      subtype.startsWith('مرخصی')
    );
  if (type === 'attendance')
    return (
      ['time.corrections', 'requests.attendance'].includes(key) ||
      subtype === 'اصلاح تردد'
    );
  if (type === 'advance')
    return key === 'expenses.advances' || subtype === 'مساعده';
  return false;
}
