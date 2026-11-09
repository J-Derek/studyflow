import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildDocx, fileNameFor } from './exportDocx';

async function documentXml(blob: Blob): Promise<string> {
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  return strFromU8(files['word/document.xml']!);
}

describe('fileNameFor', () => {
  it('makes a safe file name from a title', () => {
    expect(fileNameFor('Essay: "Contract law" / part 2?', 'docx')).toBe('Essay-Contract-law-part-2.docx');
    expect(fileNameFor('', 'pdf')).toBe('draft.pdf');
    expect(fileNameFor('???', 'docx')).toBe('draft.docx');
    expect(fileNameFor('Insha ya Kiswahili ñ', 'docx')).toBe('Insha-ya-Kiswahili-ñ.docx');
  });
});

describe('buildDocx', () => {
  it('is a real zip (a .docx) with the title and the text inside', async () => {
    const blob = await buildDocx('My essay', 'Hello **bold** and *slanted* world.');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]); // "PK"
    const xml = await documentXml(blob);
    expect(xml).toContain('My essay');
    expect(xml).toContain('Hello ');
    expect(xml).toContain('bold');
    expect(xml).toContain('<w:b/>');
    expect(xml).toContain('<w:i/>');
  });
  it('turns headings and lists into Word headings and list items, each numbered list starting again', async () => {
    const xml = await documentXml(await buildDocx('T', '# Big\n\n## Medium\n\n- a\n- b\n\n1. one\n2. two\n\n1. again'));
    expect(xml).toContain('Heading1');
    expect(xml).toContain('Heading2');
    expect((xml.match(/<w:numPr>/g) ?? []).length).toBe(5);
    expect(xml).toContain('one');
  });
  it('keeps web links clickable but not links inside the app, and treats markup as text', async () => {
    const xml = await documentXml(await buildDocx('T', '[site](https://example.com) and [home](/privacy) <b>raw</b>'));
    expect(xml).toContain('w:hyperlink');
    expect(xml).toContain('home');
    expect(xml).toContain('&lt;b&gt;raw&lt;/b&gt;');
  });
  it('copes with an empty text and a very long one', async () => {
    expect((await buildDocx('Empty', '')).size).toBeGreaterThan(1000);
    const long = Array.from({ length: 3000 }, (_, i) => `Paragraph ${i} with some words.`).join('\n\n');
    expect((await documentXml(await buildDocx('Long', long))).length).toBeGreaterThan(100000);
  });
});
