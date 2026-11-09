import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { strFromU8, unzipSync } from 'fflate';
import { expect, test, type Page } from '@playwright/test';

/** PR9: the writing space for an assignment, with automatic saving and export to Word and PDF. */
type S = { userId: string | null; isSyncing: boolean; addAssignment: (a: object) => void; setTheme: (t: 'light' | 'dark') => void };
type W = { __store: { getState: () => S } };

async function open(page: Page, path = '/assignments'): Promise<void> {
  await page.goto(path);
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await page.evaluate(() =>
    (window as unknown as W).__store.getState().addAssignment({ title: 'Contract law essay', course: 'LAW 101', dueDate: '2030-01-15', priority: 'medium', status: 'pending', progress: 0 })
  );
  await page.getByRole('button', { name: 'Write for "Contract law essay"' }).click();
  await expect(page.getByTestId('writing-space')).toBeVisible();
}

const area = (page: Page) => page.getByRole('textbox', { name: 'Your writing' });

test('write, format, autosave, close, and find it again after a reload', async ({ page }) => {
  await open(page);
  const space = page.getByTestId('writing-space');
  await expect(space).toContainText('Contract law essay');
  await area(page).fill('Offer and acceptance');
  await expect(page.getByTestId('draft-status')).toContainText('Saving');
  await expect(page.getByTestId('draft-status')).toContainText('Saved', { timeout: 5000 });
  await expect(page.getByTestId('draft-status')).toContainText('3 words');

  // the Heading button turns the line into a heading; the preview follows
  await area(page).click();
  await space.getByRole('button', { name: 'Heading' }).click();
  await expect(area(page)).toHaveValue('## Offer and acceptance');
  await expect(page.getByTestId('draft-preview').getByRole('heading', { name: 'Offer and acceptance' })).toBeVisible();

  // bold on a selection
  await area(page).fill('plain words here');
  await area(page).evaluate((el) => (el as HTMLTextAreaElement).setSelectionRange(6, 11));
  await space.getByRole('button', { name: 'Bold' }).click();
  await expect(area(page)).toHaveValue('plain **words** here');
  await expect(page.getByTestId('draft-preview').locator('strong')).toHaveText('words');

  // closing saves at once (no waiting for the timer), and the text is there next time, also after a reload
  await area(page).fill('Final text kept');
  await space.getByRole('button', { name: 'Close writing space' }).click();
  await expect(page.getByTestId('writing-space')).toHaveCount(0);
  await page.waitForFunction(() => (localStorage.getItem('studyflow_storage_v1') ?? '').includes('Final text kept'));
  await page.waitForFunction(() => !(window as unknown as W).__store.getState().isSyncing);
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await page.getByRole('button', { name: 'Write for "Contract law essay"' }).click();
  await expect(area(page)).toHaveValue('Final text kept');
});

test('the draft reaches the account, and what is typed is never treated as HTML', async ({ page }) => {
  await open(page);
  await area(page).fill('<img src=x onerror="window.__pwned=1"> and <script>window.__pwned=2</script>');
  const uid = await page.evaluate(() => (window as unknown as W).__store.getState().userId);
  await expect(page.getByTestId('draft-status')).toContainText('Saved', { timeout: 5000 });
  await expect(page.getByTestId('draft-preview')).toContainText('<img src=x');
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
  expect(await page.locator('[data-testid="draft-preview"] img, [data-testid="draft-preview"] script').count()).toBe(0);
  await expect
    .poll(async () => {
      const id = await page.evaluate(() => (window as unknown as { __store: { getState: () => { assignments: { id: string; title: string }[] } } }).__store.getState().assignments[0]!.id);
      const r = await fetch(`http://127.0.0.1:8080/v1/projects/studyflow-e2e/databases/(default)/documents/users/${uid}/drafts/${id}`, { headers: { Authorization: 'Bearer owner' } });
      return r.status === 200 ? JSON.stringify(await r.json()).includes('onerror') : false;
    }, { timeout: 15_000 })
    .toBe(true);
});

test('Word export downloads a real .docx with the title and the text', async ({ page }) => {
  await open(page);
  await area(page).fill('# Introduction\n\nThis is **important** and this is a list:\n\n- first\n- second');
  const download = page.waitForEvent('download');
  await page.getByTestId('writing-space').getByRole('button', { name: 'Word' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('Contract-law-essay.docx');
  const bytes = await readFile((await file.path())!);
  const xml = strFromU8(unzipSync(new Uint8Array(bytes))['word/document.xml']!);
  for (const needle of ['Contract law essay', 'Introduction', 'important', 'first', 'second', '<w:b/>']) expect(xml, needle).toContain(needle);
});

test('PDF: printing shows only the text with its title, black on white, even in dark mode', async ({ page }) => {
  await open(page);
  await page.evaluate(() => (window as unknown as W).__store.getState().setTheme('dark'));
  await area(page).fill('## Part one\n\nBody text for the PDF.');
  await expect(page.getByTestId('draft-status')).toContainText('Saved', { timeout: 5000 });
  await page.emulateMedia({ media: 'print' });
  const printRoot = page.getByTestId('print-root');
  await expect(printRoot).toBeVisible();
  await expect(printRoot).toContainText('Contract law essay');
  await expect(printRoot).toContainText('Body text for the PDF.');
  await expect(page.locator('#root')).toBeHidden();
  const colours = await printRoot.evaluate((el) => ({ fg: getComputedStyle(el.querySelector('p')!).color, bg: getComputedStyle(el).backgroundColor }));
  expect(colours.fg).toBe('rgb(0, 0, 0)');
  expect(colours.bg).toBe('rgb(255, 255, 255)');
  const pdf = await page.pdf();
  expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  await page.emulateMedia({ media: 'screen' });
  await expect(printRoot).toBeHidden();
});

test('on a phone: Write/Preview tabs, 44px controls, fits the screen, no accessibility problems in light or dark', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await open(page);
  const space = page.getByTestId('writing-space');
  await area(page).fill('## Heading\n\nSome words');
  await expect(page.getByTestId('draft-preview')).toBeHidden();
  await space.getByRole('button', { name: 'preview', exact: true }).click();
  await expect(page.getByTestId('draft-preview')).toBeVisible();
  await expect(area(page)).toBeHidden();
  await space.getByRole('button', { name: 'write', exact: true }).click();

  for (const b of await space.locator('button').all()) {
    if (await b.isVisible()) expect((await b.boundingBox())!.height, await b.innerText() || (await b.getAttribute('aria-label')) || '').toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((t) => (window as unknown as W).__store.getState().setTheme(t), theme);
    await page.waitForTimeout(300);
    const axe = await new AxeBuilder({ page }).include('[data-testid="writing-space"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations.map((v) => `${theme} ${v.id}: ${v.nodes.map((n) => n.html.slice(0, 90)).join(' | ')}`)).toEqual([]);
  }
});

test('the Today screen has a Write button on Next up, and the Escape key closes the space and keeps the text', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await page.evaluate(() =>
    (window as unknown as W).__store.getState().addAssignment({ title: 'Lab report', course: 'PHY 201', dueDate: '2030-01-15', priority: 'high', status: 'pending', progress: 0 })
  );
  await page.getByRole('button', { name: 'Write', exact: true }).click();
  await area(page).fill('Draft from Today');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('writing-space')).toHaveCount(0);
  await page.getByRole('button', { name: 'Write', exact: true }).click();
  await expect(area(page)).toHaveValue('Draft from Today');
});
