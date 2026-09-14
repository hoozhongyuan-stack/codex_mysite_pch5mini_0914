import React from 'react';
export function RichView({ doc }: { doc: any }) {
  function node(n: any, i: number): React.ReactNode {
    const children = n.content?.map(node);
    if (n.type === 'text') {
      return (n.marks || []).reduce(
        (value: React.ReactNode, m: any) =>
          m.type === 'link' ? (
            <a href={m.attrs.href} rel="noreferrer" key={i}>
              {value}
            </a>
          ) : (
            React.createElement(
              (
                {
                  bold: 'strong',
                  italic: 'em',
                  underline: 'u',
                  strike: 's',
                  code: 'code',
                } as any
              )[m.type] || 'span',
              null,
              value,
            )
          ),
        n.text,
      );
    }
    if (n.type === 'image')
      return (
        <img key={i} src={n.attrs.src} alt={n.attrs.alt || ''} loading="lazy" />
      );
    if (n.type === 'video')
      return (
        <video
          key={i}
          src={n.attrs.src}
          controls
          preload="metadata"
          aria-label={n.attrs.alt}
        />
      );
    if (n.type === 'doc')
      return <React.Fragment key={i}>{children}</React.Fragment>;
    const tag =
      n.type === 'heading'
        ? 'h' + n.attrs.level
        : (
            {
              paragraph: 'p',
              bulletList: 'ul',
              orderedList: 'ol',
              listItem: 'li',
              blockquote: 'blockquote',
              hardBreak: 'br',
              horizontalRule: 'hr',
              codeBlock: 'pre',
              table: 'table',
              tableRow: 'tr',
              tableCell: 'td',
              tableHeader: 'th',
            } as any
          )[n.type] || 'div';
    const props: any = { key: i };
    if (['td', 'th'].includes(tag)) {
      props.colSpan = n.attrs?.colspan;
      props.rowSpan = n.attrs?.rowspan;
    }
    if (tag === 'ol') props.start = n.attrs?.start;
    return React.createElement(
      tag,
      props,
      ...(tag === 'table'
        ? [<tbody key="body">{children}</tbody>]
        : tag === 'br' || tag === 'hr'
          ? []
          : [children]),
    );
  }
  return <div className="rich-content">{node(doc, 0)}</div>;
}
