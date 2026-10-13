import { getTool, validateToolInput } from './tools.mjs';
import { requireToolAccess } from './authorization.mjs';
import { ServiceError } from './errors.mjs';

export function createToolExecutor({
  client,
  authenticate,
  now = () => new Date(),
}) {
  return async function execute(
    id,
    input,
    { cookie, signal, actorId, observedAt, record = () => {} },
  ) {
    const tool = getTool(id);
    validateToolInput(input);
    let outcome = 'FAILED';
    try {
      if (typeof actorId !== 'string' || !actorId)
        throw new ServiceError(401, 'UNAUTHENTICATED');
      if (signal.aborted) throw new ServiceError(502, 'SOURCE_TIMEOUT');
      const actor = await authenticate(
        cookie,
        signal,
        actorId,
        tool.identitySource,
      );
      requireToolAccess(actor, id);
      const body = await client.readTool(id, cookie, signal);
      if (!tool.validate(body)) throw new ServiceError(502, 'INVALID_SOURCE');
      const result = tool.project(body, observedAt ?? now());
      const releaseActor = await authenticate(
        cookie,
        signal,
        actorId,
        tool.identitySource,
      );
      requireToolAccess(releaseActor, id);
      if (
        actor.branchIds.some(
          (branchId) => !releaseActor.branchIds.includes(branchId),
        )
      )
        throw new ServiceError(403, 'FORBIDDEN');
      if (signal.aborted) throw new ServiceError(502, 'SOURCE_TIMEOUT');
      outcome = 'SUCCESS';
      return result;
    } catch (error) {
      if (error instanceof ServiceError && [401, 403].includes(error.status))
        outcome = 'DENIED';
      throw error;
    } finally {
      record({ tool: tool.id, outcome });
    }
  };
}
