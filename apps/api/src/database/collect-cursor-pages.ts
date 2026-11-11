// Read within a stable snapshot and include the unique ID in the page order.
export async function collectCursorPages<Row extends { id: string }, Result>(
  pageSize: number,
  read: (page: {
    take: number;
    cursor?: { id: string };
    skip?: number;
  }) => Promise<readonly Row[]>,
  project: (row: Row) => Result,
  maximumRows = Infinity,
) {
  const results: Result[] = [];
  let cursor: { id: string } | undefined;
  while (results.length < maximumRows) {
    const take = Math.min(pageSize, maximumRows - results.length);
    const rows = await read({
      take,
      ...(cursor ? { cursor, skip: 1 } : {}),
    });
    for (const row of rows) results.push(project(row));
    if (rows.length < take) return results;
    cursor = { id: rows[rows.length - 1]!.id };
  }
  return results;
}
