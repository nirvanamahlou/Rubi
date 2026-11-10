// Read within a stable snapshot and include the unique ID in the page order.
export async function collectCursorPages<Row extends { id: string }, Result>(
  pageSize: number,
  read: (page: {
    take: number;
    cursor?: { id: string };
    skip?: number;
  }) => Promise<readonly Row[]>,
  project: (row: Row) => Result,
) {
  const results: Result[] = [];
  let cursor: { id: string } | undefined;
  for (;;) {
    const rows = await read({
      take: pageSize,
      ...(cursor ? { cursor, skip: 1 } : {}),
    });
    for (const row of rows) results.push(project(row));
    if (rows.length < pageSize) return results;
    cursor = { id: rows[rows.length - 1]!.id };
  }
}
