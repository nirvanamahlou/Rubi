import { HttpException } from '@nestjs/common';
import { fallback, type StickyDecision } from './sticky-sales';

/** Internal preview boundary, not a PBX endpoint. No late result can dial a call. */
export class StickyPreviewBudget {
  private inFlight = 0;
  async run(
    queue: string,
    read: (signal: AbortSignal) => Promise<StickyDecision>,
  ): Promise<StickyDecision> {
    if (this.inFlight >= 8) return fallback(queue, 'LOOKUP_BUSY');
    this.inFlight++;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<StickyDecision>((resolve) => {
      timer = setTimeout(() => {
        abort.abort();
        resolve(fallback(queue, 'LOOKUP_TIMEOUT'));
      }, 1000);
    });
    const operation = Promise.resolve()
      .then(() => read(abort.signal))
      .catch((error: unknown) => {
        // Permission/scope failures must never turn into an authorized routing response.
        if (error instanceof HttpException) throw error;
        return fallback(queue, 'LOOKUP_UNAVAILABLE');
      })
      .finally(() => {
        this.inFlight--;
      });
    try {
      return await Promise.race([operation, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
