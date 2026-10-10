import type {
  WorkbenchCalendarEventV1,
  WorkbenchNoteInputV1,
  WorkbenchNoteV1,
} from '@nora/contracts';
import { tehranDay } from './calendar-model';

export interface AssignedFollowUp {
  id: string;
  requestId: string;
  title: string;
  dueAt: string | null;
}

export interface DailyFollowUp {
  id: string;
  title: string;
  source: 'calendar' | 'note' | 'procurement';
  dueAt: string | null;
  href: string;
  description: string;
}

const marker = (id: string) => `daily-follow-up:[${id}]`;

export function followUpNoteInput(item: DailyFollowUp): WorkbenchNoteInputV1 {
  const sourceName = item.source === 'calendar' ? 'تقویم من' : 'پیگیری خرید';
  return {
    title: `پیگیری: ${item.title}`.slice(0, 200),
    body: `${item.description}\n\nمنبع: ${sourceName}`,
    folder: 'شخصی',
    tags: `پیگیری روزانه، ${marker(item.id)}`,
    items: [],
    pinned: false,
    reminderAt: item.dueAt,
  };
}

function dayOffset(day: string, count: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

export function dailyFollowUps(
  input: {
    notes: readonly WorkbenchNoteV1[];
    events: readonly WorkbenchCalendarEventV1[];
    procurement: readonly AssignedFollowUp[];
  },
  today = tehranDay(new Date()),
): DailyFollowUp[] {
  if (!today) return [];
  const lastDay = dayOffset(today, 7);
  const dueSoon = (value: string | null) => {
    const day = value ? tehranDay(value) : null;
    return day !== null && day <= lastDay;
  };
  const items: DailyFollowUp[] = [
    ...input.events
      .filter(
        (event) =>
          event.status !== 'COMPLETED' &&
          event.status !== 'CANCELLED' &&
          dueSoon(event.dueAt),
      )
      .map((event) => ({
        id: `calendar:${event.id}`,
        title: event.title,
        source: 'calendar' as const,
        dueAt: event.dueAt,
        href: '/workbench?tab=calendar',
        description: event.description || 'رویداد تقویم من',
      })),
    ...input.notes
      .filter(
        (note) =>
          !note.tags.includes('daily-follow-up:[') &&
          dueSoon(note.reminderAt) &&
          (!note.items.length || note.items.some((item) => !item.done)),
      )
      .map((note) => ({
        id: `note:${note.id}`,
        title: note.title,
        source: 'note' as const,
        dueAt: note.reminderAt,
        href: '/workbench?tab=notes',
        description: note.body || 'یادآور یادداشت شخصی',
      })),
    ...input.procurement.map((task) => ({
      id: `procurement:${task.id}`,
      title: task.title,
      source: 'procurement' as const,
      dueAt: task.dueAt,
      href: `/purchases?section=requests&request=${encodeURIComponent(task.requestId)}`,
      description: 'پیگیری خرید واگذارشده به شما',
    })),
  ];
  return items
    .filter(
      (item) =>
        !input.notes.some((note) => note.tags.includes(marker(item.id))),
    )
    .sort((a, b) => {
      const first = a.dueAt ? tehranDay(a.dueAt) : null;
      const second = b.dueAt ? tehranDay(b.dueAt) : null;
      return (first ?? '9999-12-31').localeCompare(second ?? '9999-12-31');
    })
    .slice(0, 6);
}
