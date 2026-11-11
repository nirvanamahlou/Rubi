/** Keep locations and machine error codes, never messages, SQL or provider bodies. */
export function errorDiagnostics(value: unknown, depth = 0): object {
  if (!(value instanceof Error)) return { type: 'NonErrorThrown' };
  const frames = (value.stack ?? '')
    .split('\n')
    .slice(1)
    .flatMap((line) => {
      const match = line.match(
        /((?:src|dist)[\\/][A-Za-z0-9_./\\-]+\.[cm]?[jt]sx?):(\d+):(\d+)/,
      );
      return match
        ? [`${match[1]!.replaceAll('\\', '/')}:${match[2]}:${match[3]}`]
        : [];
    })
    .slice(0, 12);
  const code = 'code' in value ? value.code : undefined;
  const safeCode =
    typeof code === 'string' &&
    (/^P\d{4}$/.test(code) ||
      [
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',
        'ECONNRESET',
        'ENOENT',
        'EACCES',
        'ENOSPC',
      ].includes(code))
      ? code
      : undefined;
  return {
    type: [
      'Error',
      'TypeError',
      'RangeError',
      'SyntaxError',
      'ReferenceError',
      'AggregateError',
    ].includes(value.name)
      ? value.name
      : 'ApplicationError',
    ...(safeCode ? { code: safeCode } : {}),
    frames,
    ...(depth < 2 && value.cause instanceof Error
      ? { cause: errorDiagnostics(value.cause, depth + 1) }
      : {}),
  };
}
