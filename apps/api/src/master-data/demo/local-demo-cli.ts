export const LOCAL_DEMO_ACKNOWLEDGEMENT =
  '--acknowledge-local-synthetic-data' as const;

const modes = [
  '--preview',
  '--apply',
  '--preview-realistic',
  '--apply-realistic',
] as const;

export type LocalDemoMode = (typeof modes)[number];

export function parseLocalDemoCli(
  args: string[],
  environment: NodeJS.ProcessEnv,
): { mode: LocalDemoMode; apply: boolean; realistic: boolean } {
  const [candidate, acknowledgement, ...unexpected] = args;
  if (
    !modes.includes(candidate as LocalDemoMode) ||
    unexpected.length > 0 ||
    (acknowledgement !== undefined &&
      acknowledgement !== LOCAL_DEMO_ACKNOWLEDGEMENT)
  )
    throw new Error(
      'Specify --preview/--apply or --preview-realistic/--apply-realistic. Apply also requires the explicit local-synthetic-data acknowledgement. Build the API first.',
    );

  const mode = candidate as LocalDemoMode;
  const apply = mode.startsWith('--apply');
  if (!apply && acknowledgement)
    throw new Error('Preview does not accept an apply acknowledgement.');
  if (
    apply &&
    acknowledgement !== LOCAL_DEMO_ACKNOWLEDGEMENT &&
    environment.RUBI_ALLOW_LOCAL_MASTER_DEMO !== '1'
  )
    throw new Error(
      `Pass ${LOCAL_DEMO_ACKNOWLEDGEMENT} or set RUBI_ALLOW_LOCAL_MASTER_DEMO=1 to acknowledge local synthetic data creation.`,
    );

  return {
    mode,
    apply,
    realistic: mode.endsWith('-realistic'),
  };
}
