import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import {
  salesAssistantWindows,
  tehranMidnight,
} from './sales-assistant-report';

export interface AssistantReportFilters {
  startDate: string;
  endDate: string;
  originId: string | null;
  destinationId: string | null;
  branchId: string | null;
}

const dayMs = 86400000;
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
function date(value: unknown): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new BadRequestException('ASSISTANT_INVALID_FILTER');
  const result = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(result.getTime()) ||
    result.toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException('ASSISTANT_INVALID_FILTER');
  return result;
}
function civilDate(value: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB-u-ca-gregory', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date(value))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Public Sales read contract; selectors never grant additional access. */
export function parseAssistantReportFilters(
  query: Record<string, unknown>,
  actor: AuthenticatedActor,
  now: Date,
) {
  const keys = [
    'startDate',
    'endDate',
    'originId',
    'destinationId',
    'branchId',
  ];
  if (
    Object.keys(query).some((key) => !keys.includes(key)) ||
    (query.startDate === undefined) !== (query.endDate === undefined)
  )
    throw new BadRequestException('ASSISTANT_INVALID_FILTER');
  const defaults = salesAssistantWindows(now);
  const startDate = query.startDate ?? civilDate(defaults.current.startUtc);
  const endDate =
    query.endDate ??
    new Date(date(civilDate(defaults.current.endUtc)).getTime() - dayMs)
      .toISOString()
      .slice(0, 10);
  const start = date(startDate),
    end = date(endDate);
  const days = (end.getTime() - start.getTime()) / dayMs + 1;
  if (days < 1 || days > 90 || String(endDate) >= civilDate(now.toISOString()))
    throw new BadRequestException('ASSISTANT_INVALID_WINDOW');
  const selector = (key: string) => {
    const value = query[key];
    if (value === undefined) return null;
    if (typeof value !== 'string' || !uuid.test(value))
      throw new BadRequestException('ASSISTANT_INVALID_FILTER');
    return value.toLowerCase();
  };
  const filters: AssistantReportFilters = {
    startDate: String(startDate),
    endDate: String(endDate),
    originId: selector('originId'),
    destinationId: selector('destinationId'),
    branchId: selector('branchId'),
  };
  if (filters.branchId && !actor.branchIds.includes(filters.branchId))
    throw new ForbiddenException('ASSISTANT_BRANCH_FORBIDDEN');
  const current = {
    startUtc: tehranMidnight(start).toISOString(),
    endUtc: tehranMidnight(new Date(end.getTime() + dayMs)).toISOString(),
  };
  return {
    filters,
    windows: {
      current,
      previous: {
        startUtc: tehranMidnight(
          new Date(start.getTime() - days * dayMs),
        ).toISOString(),
        endUtc: current.startUtc,
      },
    },
  };
}
