import { describe, it, expect, vi } from 'vitest';
import type {
  AuthenticatedActor,
  TravelWorkflowCommandV1,
  TravelWorkflowStateV1,
} from '@nora/contracts';
import { TravelWorkflowService } from './travel-workflow.service';
import { initialTravelWorkflow } from './travel-workflow';
const actor = {
  userId: 'operator',
  branchIds: ['branch'],
  permissions: ['reservations.documents.manage'],
} as AuthenticatedActor;
const command: TravelWorkflowCommandV1 = {
  action: 'TICKET_FLIGHT_NUMBERS',
  expectedVersion: 0,
  note: 'Synthetic correction',
  ticketFlightNumbers: { 'flight-offer': 'B9 4599' },
};
function setup() {
  const state = initialTravelWorkflow();
  const tx = {
    $queryRaw: vi.fn(async () => []),
    reservationWorkflowRevision: {
      findFirst: vi.fn(async () => ({ state })),
      create: vi.fn(async () => ({})),
    },
  };
  const db = {
    client: {
      $transaction: vi.fn(
        async (
          fn: (transaction: typeof tx) => Promise<TravelWorkflowStateV1>,
        ) => fn(tx),
      ),
    },
  };
  const service = new TravelWorkflowService(
    db as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const detail = vi.spyOn(service, 'detail').mockResolvedValue({
    workflow: state,
    snapshot: {
      passengerIds: [],
      serviceSelections: [{ clientKey: 'flight', kind: 'FLIGHT' }],
      ticketSelections: [
        {
          serviceClientKey: 'flight',
          offerId: 'offer',
          direction: 'OUTBOUND',
          originId: 'a',
          destinationId: 'b',
          departureAt: '2099-01-01',
          carrierNameSnapshot: 'Synthetic',
          serviceNumberSnapshot: '123',
          cabinClassCode: 'ECONOMY',
        },
      ],
    },
  } as never);
  return { service, detail, tx, state };
}
describe('persisted ticket flight-number correction', () => {
  it('uses branch-scoped intake, serializes writes and appends an actor-stamped revision', async () => {
    const s = setup();
    const result = await s.service.update('request', command, actor);
    expect(s.detail).toHaveBeenCalledWith('request', ['branch'], true);
    expect(s.tx.$queryRaw).toHaveBeenCalledOnce();
    expect(s.tx.reservationWorkflowRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        intakeId: 'request',
        version: 1,
        actorUserId: 'operator',
        state: expect.objectContaining({
          ticketFlightNumbers: { 'flight-offer': 'B9 4599' },
          updatedByUserId: 'operator',
          updatedAt: expect.any(String),
        }),
      }),
    });
    expect(result.ticketFlightNumbers).toEqual(command.ticketFlightNumbers);
    expect(s.state.ticketFlightNumbers).toBeUndefined();
  });
  it('rejects unauthorized and stale/foreign writes without appending history', async () => {
    const s = setup();
    await expect(
      s.service.update('request', command, { ...actor, permissions: [] }),
    ).rejects.toThrow('مجوز');
    expect(s.detail).not.toHaveBeenCalled();
    await expect(
      s.service.update('request', { ...command, expectedVersion: 5 }, actor),
    ).rejects.toThrow('هم‌زمان');
    await expect(
      s.service.update(
        'request',
        { ...command, ticketFlightNumbers: { foreign: '123' } },
        actor,
      ),
    ).rejects.toThrow('همین قرارداد');
    expect(s.tx.reservationWorkflowRevision.create).not.toHaveBeenCalled();
  });
});
