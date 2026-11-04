import type { AmiMessage } from './ami';
import type { MemberSnapshot } from './sticky-sales';

/** QueueStatus does not report the inherited queue wrap-up policy in Asterisk16. */
export function queueWrapupPolicy(
  raw: string | undefined,
  queue: string,
): number | null {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return null;
    const seconds: unknown = (value as Record<string, unknown>)[queue];
    return typeof seconds === 'number' &&
      Number.isInteger(seconds) &&
      seconds >= 0 &&
      seconds <= 86400
      ? seconds
      : null;
  } catch {
    return null;
  }
}

const integer = (value: string | undefined) =>
  value && /^\d{1,10}$/.test(value) ? Number(value) : null;

/** Bounded, ephemeral projection: never retain QueueEntry caller data or names. */
export class QueueSnapshotCollector {
  private count = 0;
  private params = 0;
  private valid = true;
  private complete = false;
  private members: MemberSnapshot['members'][number][] = [];
  constructor(
    readonly queue: string,
    readonly actionId: string,
    private readonly wrapupSeconds: number,
    private readonly startedAt = new Date(),
  ) {}

  accept(message: AmiMessage) {
    if (
      message.queue === this.queue &&
      [
        'QueueMemberStatus',
        'QueueMemberPause',
        'QueueMemberAdded',
        'QueueMemberRemoved',
      ].includes(message.event ?? '')
    )
      this.valid = false;
    if (message.actionid !== this.actionId || !message.event) return;
    if (this.complete) {
      this.valid = false;
      return;
    }
    if (message.event === 'QueueStatusComplete') {
      this.complete = true;
      if (integer(message.listitems) !== this.count) this.valid = false;
      return;
    }
    if (++this.count > 2048 || message.queue !== this.queue) {
      this.valid = false;
      return;
    }
    if (message.event === 'QueueParams') {
      this.params++;
      return;
    }
    if (message.event === 'QueueEntry') return;
    if (message.event !== 'QueueMember') {
      this.valid = false;
      return;
    }
    const extension = /^Local\/(\d{2,10})@from-queue\/n$/.exec(
      message.location ?? '',
    )?.[1];
    // Unsupported interfaces cannot be inferred from a display name.
    if (!extension) {
      this.valid = false;
      return;
    }
    const lastCall = integer(message.lastcall),
      memberWrapup = integer(message.wrapuptime);
    const seconds = memberWrapup === 0 ? this.wrapupSeconds : memberWrapup;
    const now = Math.floor(this.startedAt.getTime() / 1000);
    const rested =
      lastCall !== null &&
      lastCall <= now &&
      seconds !== null &&
      seconds <= 86400 &&
      (lastCall === 0 || now - lastCall >= seconds);
    this.members.push({
      extension,
      active: true,
      paused: message.paused !== '0',
      available: message.status === '1' && message.incall === '0' && rested,
    });
  }
  snapshot(): MemberSnapshot | null {
    if (
      !this.valid ||
      !this.complete ||
      this.params !== 1 ||
      !Number.isInteger(this.wrapupSeconds) ||
      this.wrapupSeconds < 0 ||
      this.wrapupSeconds > 86400
    )
      return null;
    return {
      queue: this.queue,
      observedAt: this.startedAt,
      members: this.members,
    };
  }
}
