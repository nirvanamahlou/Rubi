/** Fixed read endpoints retain native authentication and read-only database enforcement. */
export function allowsAssistantReadRequest(
  method: string,
  path: string,
  agentEnabled: boolean,
): boolean {
  return (
    ['GET', 'HEAD'].includes(method) ||
    (agentEnabled &&
      method === 'POST' &&
      [
        '/api/v1/sales/assistant-agent/query',
        '/api/v1/sales/assistant-agent/count-breakdown',
        '/api/v1/sales/assistant-agent/hotel-ranking',
        '/api/v1/sales/assistant-agent/rolling-sales',
      ].includes(path))
  );
}
