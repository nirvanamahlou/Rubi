import { TOOLS } from './tools.mjs';

const ids = new Set(TOOLS.map((tool) => tool.id));
const outcomes = new Set(['SUCCESS', 'FAILED', 'DENIED']);
const actions = new Set([
  'daily-summary',
  'sales-analysis',
  'receivables-follow-up',
]);

// Construct an allowlisted event rather than serializing request/source objects.
export function recordRequestAudit(
  sink,
  {
    action,
    correlationId,
    actorId,
    at,
    outcome,
    tools,
    durationMs,
    conversation = false,
  },
) {
  try {
    sink({
      event: conversation
        ? 'assistant.conversation.read'
        : actions.has(action)
          ? 'assistant.action.read'
          : 'assistant.executive.read',
      ...(actions.has(action) ? { action } : {}),
      correlationId,
      ...(actorId ? { actorId } : {}),
      at,
      outcome,
      tools: tools
        .filter((item) => ids.has(item.tool) && outcomes.has(item.outcome))
        .map(({ tool, outcome: result }) => ({ tool, outcome: result })),
      durationMs,
    });
  } catch {
    // A retained, access-controlled sink is a deployment prerequisite.
  }
}
