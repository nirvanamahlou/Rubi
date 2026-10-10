import { describe, expect, it } from 'vitest';
import type {
  WorkbenchCalendarEventV1,
  WorkbenchNoteV1,
} from '@nora/contracts';
import { dailyFollowUps, followUpNoteInput } from './daily-follow-ups';

const today = '2026-10-10';
const note = (overrides: Partial<WorkbenchNoteV1> = {}) =>
  ({
    id: 'note-1',
    title: 'تماس با مشتری',
    body: 'پیگیری پاسخ',
    reminderAt: '2026-10-09T21:00:00.000Z', // 10 October in Tehran
    items: [],
    tags: '',
    ...overrides,
  }) as WorkbenchNoteV1;
const event = (overrides: Partial<WorkbenchCalendarEventV1> = {}) =>
  ({
    id: 'event-1',
    title: 'جلسه',
    description: 'بررسی قرارداد',
    dueAt: '2026-10-09T22:00:00.000Z',
    status: 'PLANNED',
    ...overrides,
  }) as WorkbenchCalendarEventV1;

describe('daily follow-up suggestions', () => {
  it('includes the signed-in user sources due in the Tehran day', () => {
    const result = dailyFollowUps(
      {
        notes: [note()],
        events: [event()],
        procurement: [
          {
            id: 'task-1',
            requestId: 'request-1',
            title: 'پیگیری درخواست خرید',
            dueAt: null,
          },
        ],
      },
      today,
    );
    expect(result.map((item) => item.id)).toEqual([
      'calendar:event-1',
      'note:note-1',
      'procurement:task-1',
    ]);
    expect(result[2]?.href).toContain('request=request-1');
  });

  it('excludes completed, cancelled, checked, distant and copied items', () => {
    const result = dailyFollowUps(
      {
        notes: [
          note({ id: 'done', items: [{ text: 'تمام', done: true }] }),
          note({ id: 'later', reminderAt: '2026-10-19T00:00:00.000Z' }),
          note({
            id: 'copy',
            reminderAt: null,
            tags: 'daily-follow-up:[calendar:event-1]',
          }),
        ],
        events: [
          event(),
          event({ id: 'completed', status: 'COMPLETED' }),
          event({ id: 'cancelled', status: 'CANCELLED' }),
        ],
        procurement: [],
      },
      today,
    );
    expect(result).toEqual([]);
  });

  it('prioritizes overdue work and limits the daily list', () => {
    const result = dailyFollowUps(
      {
        notes: [],
        events: Array.from({ length: 8 }, (_, index) =>
          event({
            id: String(index),
            dueAt: `2026-10-${String(index + 10).padStart(2, '0')}T08:00:00.000Z`,
          }),
        ),
        procurement: [],
      },
      today,
    );
    expect(result).toHaveLength(6);
    expect(result[0]?.id).toBe('calendar:0');
  });

  it('creates a personal note with an exact source marker and due date', () => {
    const item = dailyFollowUps(
      { notes: [], events: [event()], procurement: [] },
      today,
    )[0]!;
    const input = followUpNoteInput(item);
    expect(input.folder).toBe('شخصی');
    expect(input.reminderAt).toBe(item.dueAt);
    expect(input.tags).toContain('daily-follow-up:[calendar:event-1]');
    expect(
      dailyFollowUps(
        {
          notes: [note({ id: 'saved', tags: input.tags, reminderAt: null })],
          events: [event()],
          procurement: [],
        },
        today,
      ),
    ).toEqual([]);
  });
});
