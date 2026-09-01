export const LOCAL_DOCUMENTS_DEMO_ACKNOWLEDGEMENT =
  '--acknowledge-local-synthetic-documents' as const;

export function parseLocalDocumentsDemoCli(
  args: string[],
  environment: NodeJS.ProcessEnv,
): { apply: boolean } {
  const [mode, acknowledgement, ...unexpected] = args;
  if (
    (mode !== '--preview' && mode !== '--apply') ||
    unexpected.length > 0 ||
    (acknowledgement !== undefined &&
      acknowledgement !== LOCAL_DOCUMENTS_DEMO_ACKNOWLEDGEMENT)
  ) {
    throw new Error(
      'Specify exactly --preview or --apply. Apply also requires the explicit local-synthetic-documents acknowledgement. Build the API first.',
    );
  }
  const apply = mode === '--apply';
  if (!apply && acknowledgement) {
    throw new Error('Preview does not accept an apply acknowledgement.');
  }
  if (
    apply &&
    acknowledgement !== LOCAL_DOCUMENTS_DEMO_ACKNOWLEDGEMENT &&
    environment.RUBI_ALLOW_LOCAL_DOCUMENTS_DEMO !== '1'
  ) {
    throw new Error(
      `Pass ${LOCAL_DOCUMENTS_DEMO_ACKNOWLEDGEMENT} or set RUBI_ALLOW_LOCAL_DOCUMENTS_DEMO=1 to acknowledge local synthetic document creation.`,
    );
  }
  return { apply };
}
