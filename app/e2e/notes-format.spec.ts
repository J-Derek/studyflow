import { readFile } from 'node:fs/promises';
import { strFromU8, unzipSync } from 'fflate';
import { expect, test, type Page } from '@playwright/test';

/** Notes have the same writing tools as assignments: the formatting buttons, formatted reading, and export to Word and PDF. */
type S = { userId: string | null; notes: { title: string; body: string }[]; addNote: (n: object) => string };
type W = { __store: { getState: () => S } };

async function ready(page: Page): Promise<void> {
  await page.goto('/notes');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
}

test('the note editor has the formatting buttons, and a saved note reads formatted, with its line breaks and links kept', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Add your first note' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title').fill('Week 3');
  const body = dialog.getByLabel('Note');
  await body.fill('Offer and acceptance\nSlides: https://example.com/w3');

  // the same buttons as the writing space, and they keep the cursor in the text
  await body.evaluate((el) => (el as HTMLTextAreaElement).setSelectionRange(0, 5));
  await dialog.getByRole('button', { name: 'Bold' }).click();
  await expect(body).toHaveValue('**Offer** and acceptance\nSlides: https://example.com/w3');
  await body.evaluate((el) => (el as HTMLTextAreaElement).setSelectionRange(0, 0));
  await dialog.getByRole('button', { name: 'Heading' }).click();
  await expect(body).toHaveValue('## **Offer** and acceptance\nSlides: https://example.com/w3');
  for (const name of ['Italic', 'Bulleted list', 'Numbered list']) await expect(dialog.getByRole('button', { name, exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Save note' }).click();

  // the card shows the words without the marks
  const card = page.getByRole('button', { name: /Week 3/ }).first();
  await expect(card).toContainText('Offer and acceptance');
  await expect(card).not.toContainText('**');

  // reading it: a heading with bold in it, and the bare address is still a safe link
  await card.click();
  await expect(dialog.getByRole('heading', { name: 'Offer and acceptance' })).toBeVisible();
  await expect(dialog.locator('strong')).toHaveText('Offer');
  const link = dialog.getByRole('link', { name: 'https://example.com/w3' });
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);

  // the full-screen reader shows it formatted too
  await dialog.getByRole('button', { name: 'Read full screen' }).click();
  await expect(page.getByRole('dialog').locator('strong')).toHaveText('Offer');
});

test('a note keeps a line break as a line break when read', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => (window as unknown as W).__store.getState().addNote({ title: 'Lines', body: 'first line\nsecond line', course: '' }));
  await page.getByRole('button', { name: /Lines/ }).first().click();
  const text = await page.getByRole('dialog').getByText('first line').innerText();
  expect(text).toBe('first line\nsecond line');
});

test('a note exports to Word and to PDF, like assignment writing', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => (window as unknown as W).__store.getState().addNote({ title: 'Exam tips', body: '## Revise\n\nPast papers are **useful**.\n\n- week 1\n- week 2', course: 'LAW 101' }));
  await page.getByRole('button', { name: /Exam tips/ }).first().click();
  const dialog = page.getByRole('dialog');

  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Word', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('Exam-tips.docx');
  const xml = strFromU8(unzipSync(new Uint8Array(await readFile((await file.path())!)))['word/document.xml']!);
  for (const needle of ['Exam tips', 'Revise', 'useful', 'week 1', '<w:b/>']) expect(xml, needle).toContain(needle);

  // PDF uses the print copy: only the note, with its title
  await expect(dialog.getByRole('button', { name: 'PDF', exact: true })).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  const printRoot = page.getByTestId('print-root');
  await expect(printRoot).toBeVisible();
  await expect(printRoot).toContainText('Exam tips');
  await expect(printRoot).toContainText('Past papers are useful.');
  await expect(printRoot.locator('strong')).toHaveText('useful');
  await expect(page.locator('#root')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
});
