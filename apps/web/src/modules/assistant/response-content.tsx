/** Render only plain text and pipe tables; never interpret HTML or executable Markdown. */
export function AssistantResponseContent({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks = [];
  const cells = (line: string) =>
    line
      .trim()
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim());
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const separator = lines[index + 1];
    if (
      line.trim().startsWith('|') &&
      line.trim().endsWith('|') &&
      separator &&
      /^\|\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|$/.test(separator.trim())
    ) {
      const headers = cells(line);
      const rows = [];
      index++;
      while (
        lines[index + 1]?.trim().startsWith('|') &&
        lines[index + 1]?.trim().endsWith('|') &&
        cells(lines[index + 1]!).length === headers.length
      ) {
        rows.push(cells(lines[++index]!));
      }
      blocks.push(
        <div key={index} className="my-2 overflow-x-auto">
          <table dir="rtl" className="w-full border-collapse text-start">
            <thead>
              <tr>
                {headers.map((cell, i) => (
                  <th
                    key={i}
                    className="border border-white/20 px-2 py-1 text-start"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className="border border-white/20 px-2 py-1">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else {
      blocks.push(
        <span key={index}>
          {line}
          {index < lines.length - 1 ? '\n' : ''}
        </span>,
      );
    }
  }
  return <>{blocks}</>;
}
