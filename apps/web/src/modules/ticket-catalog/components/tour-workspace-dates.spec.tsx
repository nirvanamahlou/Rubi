import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import type { DatePickerProps } from '@/components/ui/date-picker';
import type { TicketOfferV1, TourPackageV1 } from '@nora/contracts';
import { TourWorkspace } from './tour-workspace';

const fixture = vi.hoisted(() => ({
  cells: [] as unknown[],
  cursor: 0,
  dates: [] as DatePickerProps[],
  choices: new Map<string, { onValueChange: (id: string) => void }>(),
  buttons: [] as React.ComponentProps<'button'>[],
  flight: undefined as { flightDate: string; value: TicketOfferV1 } | undefined,
  createDeparture: vi.fn().mockResolvedValue({}),
}));

vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    const index = fixture.cursor++;
    if (!(index in fixture.cells)) fixture.cells[index] = initial;
    return [
      fixture.cells[index],
      (next: unknown) => {
        fixture.cells[index] =
          typeof next === 'function'
            ? (next as (previous: unknown) => unknown)(fixture.cells[index])
            : next;
      },
    ];
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/modules/iam/access-context', () => ({
  useAccessPermissions: () => ['ticket_catalog.manage'],
}));
vi.mock('../api/tours', () => ({
  toursApi: { createDeparture: fixture.createDeparture },
}));
vi.mock('@/modules/sales/components/contract-flight-editor', () => ({
  ContractFlightEditor: (props: NonNullable<typeof fixture.flight>) => {
    fixture.flight = props;
    return <div />;
  },
}));
vi.mock('@/modules/sales/components/sales-date-picker', () => ({
  SalesDatePicker: (props: DatePickerProps) => {
    fixture.dates.push(props);
    return (
      <button aria-label={props['aria-label']}>
        {props.value || 'انتخاب تاریخ'}
      </button>
    );
  },
}));
vi.mock('@/components/ui', () => {
  const Box = ({ children }: React.PropsWithChildren) => <div>{children}</div>;
  return {
    Card: Box,
    FormField: Box,
    SelectContent: Box,
    SelectItem: Box,
    SelectTrigger: Box,
    SelectValue: () => null,
    Input: () => null,
    Select: (
      props: React.PropsWithChildren<{ onValueChange: (id: string) => void }>,
    ) => {
      const trigger = React.Children.toArray(props.children).find(
        (child) =>
          React.isValidElement<Record<string, unknown>>(child) &&
          child.props['aria-label'],
      );
      if (React.isValidElement<Record<string, string>>(trigger))
        fixture.choices.set(trigger.props['aria-label']!, props);
      return <div>{props.children}</div>;
    },
    Button: (props: React.ComponentProps<'button'>) => {
      fixture.buttons.push(props);
      return <button disabled={props.disabled}>{props.children}</button>;
    },
  };
});

const offer = (id: string, day: string, returning = false): TicketOfferV1 =>
  ({
    id,
    branchId: 'branch',
    status: 'ACTIVE',
    carrierName: id,
    serviceNumber: id,
    remainingCapacity: 8,
    departureAt: `${day}T09:00:00Z`,
    arrivalAt: `${day}T12:00:00Z`,
    originId: returning ? 'ayt' : 'teh',
    destinationId: returning ? 'teh' : 'ayt',
  }) as TicketOfferV1;
const render = () => {
  fixture.cursor = 0;
  fixture.dates = [];
  fixture.choices.clear();
  fixture.buttons = [];
  fixture.flight = undefined;
  return renderToStaticMarkup(<TourWorkspace mode="departures" compact />);
};
const date = (label: string) =>
  fixture.dates.find((p) => p['aria-label'] === label)!;
const choose = (label: string, id: string) =>
  fixture.choices.get(label)!.onValueChange(id);
const buttons = (label: string) =>
  fixture.buttons.filter((button) =>
    renderToStaticMarkup(<>{button.children}</>).includes(label),
  );

beforeEach(() => {
  fixture.createDeparture.mockClear();
  fixture.cells = [];
  fixture.cells[0] = [
    {
      id: 'tour',
      branchId: 'branch',
      name: 'Antalya',
      originId: 'teh',
      destinationId: 'ayt',
      version: 3,
    },
  ] as TourPackageV1[];
  fixture.cells[9] = false; // Initial load finished.
  fixture.cells[10] = 'tour';
  fixture.cells[16] = {
    out: [offer('out-10', '2026-11-10'), offer('out-11', '2026-11-11')],
    back: [
      offer('back-17', '2026-11-17', true),
      offer('back-18', '2026-11-18', true),
    ],
  };
});

it('lets users pick Gregorian dates, then matching active flights, and registers those exact days', async () => {
  render();
  expect(date('تاریخ پرواز رفت').calendarSystem).toBe('gregorian');
  expect(date('تاریخ پرواز رفت').markedDates).toEqual([
    '2026-11-10',
    '2026-11-11',
  ]);
  date('تاریخ پرواز رفت').onChange!('2026-11-10');
  render();
  date('تاریخ پرواز برگشت').onChange!('2026-11-17');
  let html = render();
  expect(html).toContain('out-10');
  expect(html).not.toContain('out-11');
  expect(html).toContain('back-17');
  expect(html).not.toContain('back-18');
  choose('بلیط رفت', 'out-10');
  render();
  expect(date('تاریخ پرواز برگشت').value).toBe('2026-11-17');
  expect(date('تاریخ پرواز برگشت').minimumDate).toBe('2026-11-10');
  choose('بلیط برگشت', 'back-17');
  html = render();
  expect(html).toContain('17 Nov 2026');
  const submit = buttons('ثبت نوبت برگزاری')[0]!;
  expect(submit.disabled).toBeFalsy();
  await submit.onClick!({} as React.MouseEvent<HTMLButtonElement>);
  expect(fixture.createDeparture).toHaveBeenCalledWith(
    expect.objectContaining({
      packageId: 'tour',
      startsOn: '2026-11-10',
      endsOn: '2026-11-17',
      outboundOfferId: 'out-10',
      returnOfferId: 'back-17',
    }),
    'branch',
    expect.any(String),
  );
});

it('opens floating inventory on any chosen day and moves its clocks with the calendar', () => {
  render();
  expect(buttons('افزودن بلیط شناور').every((b) => b.disabled)).toBe(true);
  date('تاریخ پرواز رفت').onChange!('2026-12-01');
  render();
  const add = buttons('افزودن بلیط شناور')[0]!;
  expect(add.disabled).toBeFalsy();
  add.onClick!({} as React.MouseEvent<HTMLButtonElement>);
  render();
  expect(fixture.flight?.flightDate).toBe('2026-12-01');
  expect(fixture.flight?.value.supplyType).toBe('FLOATING');
  date('تاریخ پرواز رفت').onChange!('2026-12-02');
  render();
  expect(fixture.flight?.flightDate).toBe('2026-12-02');
  expect(fixture.flight?.value.departureAt).toBe('2026-12-02T11:30');
  expect(fixture.flight?.value.arrivalAt).toBe('2026-12-02T14:30');
  expect(fixture.createDeparture).not.toHaveBeenCalled();
});

it('requires a new ticket selection after changing the selected day', () => {
  render();
  choose('بلیط رفت', 'out-10');
  render();
  choose('بلیط برگشت', 'back-17');
  render();
  expect(buttons('ثبت نوبت برگزاری')[0]!.disabled).toBeFalsy();
  date('تاریخ پرواز برگشت').onChange!('2026-11-18');
  render();
  expect(buttons('ثبت نوبت برگزاری')[0]!.disabled).toBe(true);
  choose('بلیط برگشت', 'back-18');
  render();
  expect(buttons('ثبت نوبت برگزاری')[0]!.disabled).toBeFalsy();
  date('تاریخ پرواز رفت').onChange!('2026-11-11');
  render();
  expect(buttons('ثبت نوبت برگزاری')[0]!.disabled).toBe(true);
  expect(date('تاریخ پرواز برگشت').value).toBe('2026-11-18');
  expect(fixture.createDeparture).not.toHaveBeenCalled();
});
