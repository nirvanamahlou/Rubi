import type { HrPreviewDataset } from './hr-preview-data';
import { parseWeightedGoals } from './weighted-goals';

export function reportCellText(
  cell: HrPreviewDataset['rows'][number][number],
): string {
  if (typeof cell !== 'string') return cell.label;
  if (/^(hr-attachment|document):\/\//.test(cell)) return 'فایل پیوست';
  if (cell.startsWith('['))
    return parseWeightedGoals(cell)
      .map(
        (goal) =>
          `${goal.title} ـ وزن ${goal.weight} ـ ${goal.achieved ? 'محقق‌شده' : 'محقق‌نشده'}`,
      )
      .join('؛ ');
  return cell;
}
