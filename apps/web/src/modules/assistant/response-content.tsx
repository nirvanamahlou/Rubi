import { Fragment, type ReactNode } from 'react';
import { persianAssistantTerms } from './response-presentation';

/** Explicit formatting only. HTML, links, images and executable Markdown stay text. */
function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const tokens = /\*\*([^*\n]+)\*\*|__([^_\n]+)__|`([^`\n]+)`/g;
  let start = 0;
  for (const match of text.matchAll(tokens)) {
    if (match.index! > start)
      nodes.push(
        <Fragment key={`text-${start}`}>
          {text.slice(start, match.index)}
        </Fragment>,
      );
    const value = match[1] ?? match[2] ?? match[3];
    nodes.push(
      match[3] === undefined ? (
        <strong key={`token-${match.index}`}>{value}</strong>
      ) : (
        <span key={`token-${match.index}`}>{value}</span>
      ),
    );
    start = match.index! + match[0].length;
  }
  if (start < text.length)
    nodes.push(<Fragment key={`text-${start}`}>{text.slice(start)}</Fragment>);
  return nodes;
}

const listItem = (line: string) => {
  const match = /^(\s*)(?:([-+*])|([0-9۰-۹٠-٩]+)[.)])\s+(.+)$/.exec(line);
  if (!match) return null;
  const number = match[3]?.replace(/[۰-۹٠-٩]/g, (digit) =>
    String(digit.charCodeAt(0) - (digit >= '۰' ? 1776 : 1632)),
  );
  return {
    indent: match[1]!.replace(/\t/g, '    ').length,
    ordered: !!number,
    number: number ? Number(number) : undefined,
    text: match[4]!,
  };
};

export function AssistantResponseContent({
  text,
  english = false,
}: {
  text: string;
  english?: boolean;
}) {
  const lines = (english ? text : persianAssistantTerms(text)).split('\n');
  const blocks: ReactNode[] = [];
  const cells = (line: string) =>
    line
      .trim()
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim());
  const tableAt = (index: number) =>
    lines[index]?.trim().startsWith('|') &&
    lines[index]?.trim().endsWith('|') &&
    /^\|\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|$/.test(
      lines[index + 1]?.trim() ?? '',
    );
  let index = 0;
  const list = (depth = 0): ReactNode => {
    const first = listItem(lines[index]!)!;
    const items: ReactNode[] = [];
    const key = index;
    while (index < lines.length) {
      const item = listItem(lines[index]!);
      if (
        !item ||
        item.indent !== first.indent ||
        item.ordered !== first.ordered
      )
        break;
      const itemKey = index++;
      const children: ReactNode[] = [];
      while (index < lines.length) {
        const nested = listItem(lines[index]!);
        if (!nested || nested.indent <= first.indent) break;
        if (depth < 3) children.push(list(depth + 1));
        else {
          children.push(<p key={index}>{inline(nested.text)}</p>);
          index++;
        }
      }
      items.push(
        <li key={itemKey} value={item.number}>
          {inline(item.text)}
          {children}
        </li>,
      );
    }
    return first.ordered ? (
      <ol key={key} className="my-2 list-decimal ps-5">
        {items}
      </ol>
    ) : (
      <ul key={key} className="my-2 list-disc ps-5">
        {items}
      </ul>
    );
  };
  while (index < lines.length) {
    const key = index;
    const line = lines[index]!;
    if (!line.trim()) {
      index++;
      continue;
    }
    if (tableAt(index)) {
      const headers = cells(line);
      const rows: string[][] = [];
      index += 2;
      while (
        lines[index]?.trim().startsWith('|') &&
        lines[index]?.trim().endsWith('|') &&
        cells(lines[index]!).length === headers.length
      )
        rows.push(cells(lines[index++]!));
      blocks.push(
        <div key={key} className="my-2 overflow-x-auto">
          <table
            dir={english ? 'ltr' : 'rtl'}
            className="w-full border-collapse text-start"
          >
            <thead>
              <tr>
                {headers.map((cell, i) => (
                  <th
                    key={i}
                    className="border border-white/20 px-2 py-1 text-start"
                  >
                    {inline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className="border border-white/20 px-2 py-1">
                      {inline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else if (listItem(line)) blocks.push(list());
    else {
      const heading = /^(#{1,3})\s+(.+)$/.exec(line);
      if (heading) {
        blocks.push(
          <h3 key={key} className="mb-1 mt-3 text-base font-semibold">
            {inline(heading[2]!)}
          </h3>,
        );
        index++;
      } else {
        const paragraph = [line];
        index++;
        while (
          index < lines.length &&
          lines[index]!.trim() &&
          !listItem(lines[index]!) &&
          !tableAt(index) &&
          !/^#{1,3}\s/.test(lines[index]!)
        )
          paragraph.push(lines[index++]!);
        blocks.push(
          <p key={key} className="my-1 whitespace-pre-wrap">
            {inline(paragraph.join('\n'))}
          </p>,
        );
      }
    }
  }
  return <>{blocks}</>;
}
