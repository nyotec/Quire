import { ReactNode } from 'react';

export interface MarkdownCtx {
  exists: (title: string) => boolean;
  onWikilink: (target: string) => void;
  onTag?: (tag: string) => void;
}

const RX = {
  heading: /^(#{1,6})\s+(.*)$/,
  hr: /^---+$/,
  fence: /^```(\w*)\s*$/,
  blockquote: /^>\s?(.*)$/,
  listItem: /^(\s*)[-*]\s+(.*)$/,
  taskItem: /^(\s*)[-*]\s+\[([ xX])\]\s+(.*)$/,
  tableRow: /^\|(.+)\|\s*$/,
  tableSep: /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/,
};

export function renderInline(text: string, ctx: MarkdownCtx): ReactNode[] {
  const out: ReactNode[] = [];
  if (!text) return out;
  let i = 0;
  let key = 0;
  const push = (n: ReactNode) => {
    if (n !== null && n !== undefined) out.push(n);
  };

  while (i < text.length) {
    const rest = text.slice(i);

    let m = rest.match(/^\[\[([^\]]+?)\]\]/);
    if (m) {
      const target = m[1].trim();
      const exists = ctx.exists(target);
      push(
        <a
          key={key++}
          className={'q-wlink' + (exists ? '' : ' q-wlink-new')}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            ctx.onWikilink(target);
          }}
          href="#"
        >
          {target}
        </a>,
      );
      i += m[0].length;
      continue;
    }

    m = rest.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (m) {
      push(
        <a key={key++} className="q-link" href={m[2]} target="_blank" rel="noopener">
          {m[1]}
        </a>,
      );
      i += m[0].length;
      continue;
    }

    m = rest.match(/^`([^`]+)`/);
    if (m) {
      push(
        <code key={key++} className="q-code-i">
          {m[1]}
        </code>,
      );
      i += m[0].length;
      continue;
    }

    m = rest.match(/^\*\*([^*]+)\*\*/);
    if (m) {
      push(<strong key={key++}>{renderInline(m[1], ctx)}</strong>);
      i += m[0].length;
      continue;
    }

    m = rest.match(/^\*([^*\n]+)\*/);
    if (m) {
      push(<em key={key++}>{renderInline(m[1], ctx)}</em>);
      i += m[0].length;
      continue;
    }

    const prev = i === 0 ? ' ' : text[i - 1];
    if (rest[0] === '#' && /\s/.test(prev)) {
      m = rest.match(/^#([a-zA-Z0-9][\w/-]*)/);
      if (m) {
        const tagName = m[1];
        push(
          <span
            key={key++}
            className="q-tag-i"
            onClick={(e) => {
              e.stopPropagation();
              ctx.onTag && ctx.onTag(tagName);
            }}
          >
            #{tagName}
          </span>,
        );
        i += m[0].length;
        continue;
      }
    }

    const stop = rest.search(/(\[\[|`|\*\*|\*|\[[^\]]+\]\(|#[a-zA-Z])/);
    if (stop === -1) {
      push(rest);
      break;
    }
    if (stop === 0) {
      push(rest[0]);
      i += 1;
    } else {
      push(rest.slice(0, stop));
      i += stop;
    }
  }
  return out;
}

function renderTable(lines: string[], ctx: MarkdownCtx, key: number): ReactNode {
  const rows = lines.map((l) => l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
  const head = rows[0];
  const body = rows.slice(2);
  return (
    <table className="q-tbl" key={key}>
      <thead>
        <tr>
          {head.map((c, i) => (
            <th key={i}>{renderInline(c, ctx)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {body.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j}>{renderInline(c, ctx)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function renderMarkdown(text: string, ctx: MarkdownCtx): ReactNode[] {
  const lines = (text || '').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    let m = line.match(RX.fence);
    if (m) {
      const lang = m[1];
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].match(RX.fence)) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(
        <pre key={key++} className="q-code" data-lang={lang}>
          <code data-lang={lang}>{buf.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    m = line.match(RX.heading);
    if (m) {
      const lvl = m[1].length;
      const Tag = `h${Math.min(lvl + 1, 6)}` as keyof JSX.IntrinsicElements;
      blocks.push(
        <Tag key={key++} className={`q-h q-h${lvl}`}>
          {renderInline(m[2], ctx)}
        </Tag>,
      );
      i++;
      continue;
    }

    if (RX.hr.test(line)) {
      blocks.push(<hr key={key++} className="q-hr" />);
      i++;
      continue;
    }

    if (RX.tableRow.test(line) && i + 1 < lines.length && RX.tableSep.test(lines[i + 1])) {
      const buf = [line];
      i++;
      while (i < lines.length && RX.tableRow.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      blocks.push(renderTable(buf, ctx, key++));
      continue;
    }

    if (RX.blockquote.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && RX.blockquote.test(lines[i])) {
        buf.push(lines[i].replace(RX.blockquote, '$1'));
        i++;
      }
      blocks.push(
        <blockquote key={key++} className="q-bq">
          {renderInline(buf.join(' '), ctx)}
        </blockquote>,
      );
      continue;
    }

    if (RX.listItem.test(line) || RX.taskItem.test(line)) {
      const items: { task: boolean; done?: boolean; text: string }[] = [];
      while (i < lines.length && (RX.listItem.test(lines[i]) || RX.taskItem.test(lines[i]))) {
        const tm = lines[i].match(RX.taskItem);
        if (tm) {
          items.push({ task: true, done: tm[2].toLowerCase() === 'x', text: tm[3] });
        } else {
          const bm = lines[i].match(RX.listItem)!;
          items.push({ task: false, text: bm[2] });
        }
        i++;
      }
      blocks.push(
        <ul key={key++} className={'q-list' + (items.some((it) => it.task) ? ' q-list-tasks' : '')}>
          {items.map((it, idx) => (
            <li key={idx} className={it.task ? 'q-task' : ''}>
              {it.task && (
                <span className={'q-checkbox' + (it.done ? ' q-checkbox-on' : '')}>
                  {it.done ? '✓' : ''}
                </span>
              )}
              <span className={it.task && it.done ? 'q-task-done' : ''}>
                {renderInline(it.text, ctx)}
              </span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    const buf = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !RX.heading.test(lines[i]) &&
      !RX.hr.test(lines[i]) &&
      !RX.fence.test(lines[i]) &&
      !RX.blockquote.test(lines[i]) &&
      !RX.listItem.test(lines[i]) &&
      !RX.tableRow.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="q-p">
        {renderInline(buf.join(' '), ctx)}
      </p>,
    );
  }

  return blocks;
}
