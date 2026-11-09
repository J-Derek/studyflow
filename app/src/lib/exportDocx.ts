import { parseMarkdown, type Block, type Span } from '../utils/miniMarkdown';

/** A file name made from the assignment's title: letters, digits, spaces, dashes; never empty. */
export function fileNameFor(title: string, ext: string): string {
  const base = title.replace(/[^\p{L}\p{N} _-]+/gu, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'draft';
  return `${base}.${ext}`;
}

/**
 * Builds a Word document (.docx) from the Markdown a student wrote. The `docx` library is large, so it is only loaded when the student
 * presses the button. Headings, bold, italic, bullet and numbered lists and links come across; anything else is plain text.
 */
export async function buildDocx(title: string, body: string): Promise<Blob> {
  const d = await import('docx');
  const blocks = parseMarkdown(body);

  const runs = (spans: Span[], style: { bold?: boolean; italics?: boolean } = {}): (InstanceType<typeof d.TextRun> | InstanceType<typeof d.ExternalHyperlink>)[] =>
    spans.flatMap((s) => {
      if (s.kind === 'text') return [new d.TextRun({ text: s.text, ...style })];
      if (s.kind === 'bold') return runs(s.children, { ...style, bold: true });
      if (s.kind === 'italic') return runs(s.children, { ...style, italics: true });
      // A link keeps its words; addresses inside the app mean nothing in a Word file, so only web and mail links stay clickable.
      if (/^(https?:|mailto:)/i.test(s.href)) {
        return [new d.ExternalHyperlink({ link: s.href, children: [new d.TextRun({ text: spansText(s.children), style: 'Hyperlink', ...style })] })];
      }
      return runs(s.children, style);
    });

  const LEVEL = [d.HeadingLevel.HEADING_1, d.HeadingLevel.HEADING_2, d.HeadingLevel.HEADING_3] as const;
  const numberings: { reference: string; levels: { level: number; format: (typeof d.LevelFormat)['DECIMAL']; text: string; alignment: (typeof d.AlignmentType)['START'] }[] }[] = [];

  const paragraphs = [
    new d.Paragraph({ heading: d.HeadingLevel.TITLE, children: [new d.TextRun({ text: title })] }),
    ...blocks.flatMap((b: Block) => {
      if (b.kind === 'heading') return [new d.Paragraph({ heading: LEVEL[b.level - 1], children: runs(b.spans) })];
      if (b.kind === 'paragraph') return [new d.Paragraph({ children: runs(b.spans) })];
      if (b.ordered) {
        const reference = `list-${numberings.length}`; // each numbered list starts again at 1
        numberings.push({ reference, levels: [{ level: 0, format: d.LevelFormat.DECIMAL, text: '%1.', alignment: d.AlignmentType.START }] });
        return b.items.map((item) => new d.Paragraph({ numbering: { reference, level: 0 }, children: runs(item) }));
      }
      return b.items.map((item) => new d.Paragraph({ bullet: { level: 0 }, children: runs(item) }));
    })
  ];

  const doc = new d.Document({ title, numbering: { config: numberings }, sections: [{ children: paragraphs }] });
  return d.Packer.toBlob(doc);
}

function spansText(spans: Span[]): string {
  return spans.map((s) => (s.kind === 'text' ? s.text : spansText(s.children))).join('');
}

/** Builds the Word file and starts its download. */
export async function downloadDocx(title: string, body: string): Promise<void> {
  const blob = await buildDocx(title, body);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileNameFor(title, 'docx');
  a.click();
  URL.revokeObjectURL(url);
}
