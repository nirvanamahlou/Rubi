import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { SalesReservationRequestV1 } from '@rubi/contracts';
import { ReservationsPublicService } from '../reservations/reservations-public.service';
import { SalesRepository } from './sales.repository';

/** Durable outbox: acknowledge only after Reservations commits its idempotent inbox. */
@Injectable()
export class SalesReservationDispatcher
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(
    @Inject(SalesRepository) private readonly repository: SalesRepository,
    @Inject(ReservationsPublicService)
    private readonly reservations: ReservationsPublicService,
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => void this.dispatch(), 15000);
    this.timer.unref();
    void this.dispatch();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async dispatch() {
    if (this.running) return;
    this.running = true;
    try {
      for (const request of await this.repository.pendingReservationRequests()) {
        try {
          const receipt = await this.reservations.receive(
            request.snapshot as unknown as SalesReservationRequestV1,
            request.contract.branchId,
          );
          await this.repository.acknowledgeReservationRequest(
            request.id,
            receipt.id,
          );
        } catch {
          Logger.warn(
            'Reservation dispatch pending; retry scheduled.',
            'SalesReservationDispatcher',
          );
        }
      }
    } catch {
      Logger.warn(
        'Sales outbox unavailable; retry scheduled.',
        'SalesReservationDispatcher',
      );
    } finally {
      this.running = false;
    }
  }
}
