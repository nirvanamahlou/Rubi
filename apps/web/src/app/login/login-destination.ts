export function loginDestination(target: string | null): string {
  return target?.startsWith('/') &&
    !target.startsWith('//') &&
    !/[\\\u0000-\u001f]/.test(target)
    ? target
    : '/workbench';
}
