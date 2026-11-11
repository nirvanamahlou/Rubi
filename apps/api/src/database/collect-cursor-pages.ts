type CursorPage = {
  take: number;
  cursor?: { id: string };
  skip?: number;
};

// Read within a stable snapshot and include the unique ID in the page order.
export async function* cursorPages<Row extends { id: string }>(
  pageSize: number,
  read: (page: CursorPage) => Promise<readonly Row[]>,
  maximumRows = Infinity,
) {
  let readCount = 0;
  let cursor: { id: string } | undefined;
  while (readCount < maximumRows) {
    const take = Math.min(pageSize, maximumRows - readCount);
    const rows = await read({ take, ...(cursor ? { cursor, skip: 1 } : {}) });
    if (rows.length) yield rows;
    if (rows.length < take) return;
    readCount += rows.length;
    cursor = { id: rows[rows.length - 1]!.id };
  }
}

export async function collectCursorPages<Row extends { id: string }, Result>(
  pageSize: number,
  read: (page: CursorPage) => Promise<readonly Row[]>,
  project: (row: Row) => Result,
  maximumRows = Infinity,
) {
  const results: Result[] = [];
  for await (const rows of cursorPages(pageSize, read, maximumRows))
    for (const row of rows) results.push(project(row));
  return results;
}
