/** Renders stored or user-authored text without applying UI translations. */
export function VerbatimText({ value }: { value: string | null | undefined }) {
  return value ?? null;
}
