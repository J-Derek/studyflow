import React from 'react';
import { parseMarkdown, type Block, type Span } from '../utils/miniMarkdown';
import { getTabFromPath, useStudyFlowStore, type NavigationTab, type LegalTab } from '../store/studyFlowStore';

function Spans({ spans }: { spans: Span[] }): React.ReactElement {
  const setActiveTab = useStudyFlowStore((s) => s.setActiveTab);
  return (
    <>
      {spans.map((s, i) => {
        if (s.kind === 'text') return <React.Fragment key={i}>{s.text}</React.Fragment>;
        if (s.kind === 'bold') return <strong key={i}><Spans spans={s.children} /></strong>;
        if (s.kind === 'italic') return <em key={i}><Spans spans={s.children} /></em>;
        const inApp = s.href.startsWith('/');
        const tab = inApp ? getTabFromPath(s.href) : null;
        return (
          <a
            key={i}
            href={s.href}
            className="text-blue-700 dark:text-blue-300 underline underline-offset-2 hover:text-blue-900 dark:hover:text-blue-100 [overflow-wrap:anywhere]"
            {...(inApp ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
            onClick={(e) => {
              // An address inside the app opens without reloading the page.
              if (tab && tab !== 'notfound') {
                e.preventDefault();
                setActiveTab(tab as NavigationTab | LegalTab);
                window.scrollTo({ top: 0 });
              }
            }}
          >
            <Spans spans={s.children} />
          </a>
        );
      })}
    </>
  );
}

const HEADING = {
  1: 'font-display text-2xl font-semibold text-zinc-900 dark:text-zinc-50',
  2: 'font-display text-lg font-semibold text-zinc-900 dark:text-zinc-50 mt-6',
  3: 'font-semibold text-zinc-900 dark:text-zinc-50 mt-4'
} as const;

function BlockView({ block }: { block: Block }): React.ReactElement {
  if (block.kind === 'heading') {
    const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3';
    return <Tag className={HEADING[block.level]}><Spans spans={block.spans} /></Tag>;
  }
  if (block.kind === 'paragraph') {
    return <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300"><Spans spans={block.spans} /></p>;
  }
  const List = block.ordered ? 'ol' : 'ul';
  return (
    <List className={`${block.ordered ? 'list-decimal' : 'list-disc'} pl-5 space-y-1.5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300`}>
      {block.items.map((item, i) => (
        <li key={i}><Spans spans={item} /></li>
      ))}
    </List>
  );
}

/** Draws text written in the small Markdown subset (see utils/miniMarkdown). Nothing here is HTML from the text. */
export const MiniMarkdown: React.FC<{ text: string }> = ({ text }) => {
  const blocks = React.useMemo(() => parseMarkdown(text), [text]);
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </div>
  );
};
