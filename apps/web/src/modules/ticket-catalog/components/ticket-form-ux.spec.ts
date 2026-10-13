import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { saveTicketFormOnCtrlS } from './ticket-form';
import { flightScheduleDefaults } from './flight-schedule-form';
import { emptyInput } from '../model/preview';

describe('ticket form usability', () => {
  it('submits the active form with Ctrl+S', () => {
    const preventDefault = vi.fn();
    const requestSubmit = vi.fn();

    saveTicketFormOnCtrlS({
      ctrlKey: true,
      altKey: false,
      shiftKey: false,
      key: 's',
      preventDefault,
      currentTarget: { requestSubmit },
    } as never);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(requestSubmit).toHaveBeenCalledOnce();
  });

  it('keeps all weekdays visible and renders a columnar sorted date preview', () => {
    const load = readFileSync(
      new URL('./flight-load-grid.tsx', import.meta.url),
      'utf8',
    );
    const schedule = readFileSync(
      new URL('./flight-schedule-form.tsx', import.meta.url),
      'utf8',
    );

    expect(load).toContain('scheduleWeekdays.length + 1');
    expect(schedule).toContain('chronologicalScheduleDates(preview)');
    expect(schedule).toContain('<th>تاریخ رفت</th>');
    expect(schedule).toContain('<th>تاریخ برگشت</th>');
    expect(schedule).toContain('onKeyDown={saveTicketFormOnCtrlS}');
  });

  it('hydrates the full weekly form from the selected server load', () => {
    const input = emptyInput();
    input.totalCapacity = 50;
    input.flightClassId = 'economy';
    input.journeyRole = 'outbound';
    input.tripGroupId = 'pair-1';
    input.segments = [
      {
        ...input.segments[0]!,
        airlineId: 'carrier',
        flightNumber: '4512',
        originCityId: 'origin',
        destinationCityId: 'destination',
        departureZone: 'Asia/Tehran',
        arrivalZone: 'Asia/Tehran',
        departureAt: '2026-10-10T04:30:00.000Z',
        arrivalAt: '2026-10-10T07:30:00.000Z',
      },
    ];

    const defaults = flightScheduleDefaults(
      input,
      new Date('2026-10-11T00:00:00.000Z'),
    );

    expect(defaults).toEqual(
      expect.objectContaining({
        mode: 'one-way',
        start: '2026-10-10',
        end: '2026-10-10',
        allowPastDate: true,
        weekdays: [{ day: 6, stayDays: 2 }],
        outboundTime: {
          departure: '08:00',
          arrival: '11:00',
          arrivalDayOffset: 0,
        },
      }),
    );
    expect(defaults.input).toMatchObject({
      journeyRole: 'outbound',
      tripGroupId: 'pair-1',
    });
  });

  it('retains paired-load identity when saving through the weekly edit form', () => {
    const schedule = readFileSync(
      new URL('./flight-schedule-form.tsx', import.meta.url),
      'utf8',
    );
    expect(schedule).toContain('journeyRole: input.journeyRole');
    expect(schedule).toContain('tripGroupId: input.tripGroupId');
  });

  it('hydrates the complete dated table, return leg, and cabin rows for load editing', () => {
    const outbound = emptyInput();
    outbound.flightClassId = 'economy';
    outbound.totalCapacity = 40;
    outbound.journeyRole = 'outbound';
    outbound.segments = [
      {
        ...outbound.segments[0]!,
        originCityId: 'a',
        destinationCityId: 'b',
        departureZone: 'Asia/Tehran',
        arrivalZone: 'Asia/Tehran',
        departureAt: '2026-10-10T04:30:00.000Z',
        arrivalAt: '2026-10-10T07:30:00.000Z',
      },
    ];
    const nextWeek = structuredClone(outbound);
    nextWeek.segments = [
      {
        ...nextWeek.segments[0]!,
        departureAt: '2026-10-17T04:30:00.000Z',
        arrivalAt: '2026-10-17T07:30:00.000Z',
      },
    ];
    const returning = structuredClone(outbound);
    returning.journeyRole = 'return';
    returning.segments = [
      {
        ...returning.segments[0]!,
        originCityId: 'b',
        destinationCityId: 'a',
        flightNumber: 'RT-2',
        departureAt: '2026-10-12T05:30:00.000Z',
        arrivalAt: '2026-10-12T08:30:00.000Z',
      },
    ];
    const business = structuredClone(outbound);
    business.flightClassId = 'business';
    business.totalCapacity = 12;

    const defaults = flightScheduleDefaults(
      outbound,
      new Date('2026-10-01T00:00:00.000Z'),
      [outbound, nextWeek, returning, business],
    );

    expect(defaults).toMatchObject({
      mode: 'round-trip',
      start: '2026-10-10',
      end: '2026-10-17',
      weekdays: [{ day: 6, stayDays: 2 }],
      returnDetails: { flightNumber: 'RT-2' },
      returnTime: { departure: '09:00', arrival: '12:00' },
      additionalCabins: [{ flightClassId: 'business', totalCapacity: 12 }],
    });
  });

  it('prevents application dialogs from closing on outside interaction', () => {
    const overlays = readFileSync(
      new URL('../../../components/ui/overlays.tsx', import.meta.url),
      'utf8',
    );
    expect(overlays).toContain('onPointerDownOutside={(event) =>');
    expect(overlays).toContain('onInteractOutside={(event) =>');
    expect(overlays.match(/event\.preventDefault\(\)/g)).toHaveLength(2);
  });
});
