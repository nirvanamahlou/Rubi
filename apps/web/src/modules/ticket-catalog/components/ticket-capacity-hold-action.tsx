'use client';
import type { TicketOfferV1 } from '@nora/contracts';
import { Button } from '@/components/ui';
type HoldOffer = Pick<
  TicketOfferV1,
  'status' | 'departureAt' | 'remainingCapacity'
>;
/** Inspecting existing holds never requires buying another seat. */
export function TicketCapacityHoldAction({
  mode,
  offer,
  now,
  busy = false,
  onAction,
}: {
  mode: 'inspect' | 'create';
  offer?: HoldOffer | undefined;
  now: number;
  busy?: boolean;
  onAction: () => void;
}) {
  const unavailableToInspect =
    !offer ||
    offer.status !== 'ACTIVE' ||
    new Date(offer.departureAt).getTime() <= now;
  const disabled =
    busy ||
    !offer ||
    (mode === 'inspect' ? unavailableToInspect : offer.remainingCapacity < 1);
  const title =
    mode === 'inspect' && offer
      ? offer.status !== 'ACTIVE'
        ? 'غیرفعال'
        : new Date(offer.departureAt).getTime() <= now
          ? 'تاریخ گذشته'
          : offer.remainingCapacity < 1
            ? 'ظرفیت تکمیل شده'
            : undefined
      : undefined;
  return (
    <Button
      type="button"
      size={mode === 'inspect' ? 'sm' : 'md'}
      variant={mode === 'inspect' ? 'outline' : 'primary'}
      disabled={disabled}
      title={title}
      onClick={() => {
        if (!disabled) onAction();
      }}
    >
      {mode === 'inspect'
        ? 'رزرو ظرفیت'
        : busy
          ? 'در حال ثبت…'
          : 'ثبت رزرو موقت'}
    </Button>
  );
}
