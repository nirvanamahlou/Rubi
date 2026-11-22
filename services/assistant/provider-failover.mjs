import { ServiceError } from './errors.mjs';

// Construct per authenticated request, never as shared mutable routing state.
export function quotaFailover(primary, secondary) {
  let active = primary;
  let spare = secondary;
  return {
    get model() {
      return active.model;
    },
    async step(messages, options) {
      try {
        return await active.step(messages, options);
      } catch (error) {
        if (
          !(error instanceof ServiceError) ||
          error.message !== 'AGENT_PROVIDER_RATE_LIMITED' ||
          !spare
        )
          throw error;
        if (options.signal.aborted)
          throw new ServiceError(503, 'AGENT_TIMEOUT');
        // Revalidate native identity/scope before transmitting ERP evidence to
        // the other approved provider. No tool or rejected output is executed.
        if (options.beforeRetry) await options.beforeRetry();
        if (options.signal.aborted)
          throw new ServiceError(503, 'AGENT_TIMEOUT');
        const next = spare;
        spare = active;
        active = next;
        return active.step(messages, options);
      }
    },
  };
}
