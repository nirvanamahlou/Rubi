export function loginDestination(target: string | null): string {
  return target?.startsWith('/') &&
    !target.startsWith('//') &&
    !target.includes('\\') &&
    !Array.from(target).some((character) => character.charCodeAt(0) < 32)
    ? target
    : '/workbench';
}
