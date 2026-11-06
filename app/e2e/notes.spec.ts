import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

type S = {
  userId: string | null;
  isAnonymous: boolean;
  notes: Array<{ id: string; title: string; body: string; course: string; pinned: boolean }>;
  addNote: (n: object) => string;
};
const store = (page: Page) => page.evaluate(() => (window as unknown as { __store: { getState: () => S } }).__store.getState());
const ready = async (page: Page, path = '/notes') => {
  await page.goto(path);
  await page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => S } }).__store?.getState().userId);
};

test('a student can write, read, edit, pin, search, delete and undo notes', async ({ page }) => {
  await ready(page);

  // empty state first
  await expect(page.getByRole('heading', { name: 'Notes', level: 1 })).toBeVisible();
  await expect(page.getByText('No notes yet')).toBeVisible();
  await page.getByRole('button', { name: 'Add your first note' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Save note' })).toBeDisabled(); // nothing written yet
  await dialog.getByLabel('Title').fill('Week 3: contract law');
  await dialog.getByLabel('Course (optional)').fill('LAW 101');
  await dialog.getByLabel('Note').fill('Offer, acceptance, consideration.\nSlides: https://example.com/week3.pdf.');
  await dialog.getByRole('button', { name: 'Save note' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // it appears as a card with its course
  await expect(page.getByRole('button', { name: /Week 3: contract law/ }).first()).toBeVisible();
  await expect(page.locator('ul li').getByText('LAW 101', { exact: true })).toBeVisible();

  // opening it shows a reading view with a working link that leaves the page safely
  await page.getByRole('button', { name: /Week 3: contract law/ }).first().click();
  const link = page.getByRole('dialog').getByRole('link', { name: 'https://example.com/week3.pdf' });
  await expect(link).toHaveAttribute('href', 'https://example.com/week3.pdf');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);

  // edit it
  await page.getByRole('dialog').getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('dialog').getByLabel('Title').fill('Week 3: contracts');
  await page.getByRole('dialog').getByRole('button', { name: 'Save note' }).click();
  await expect(page.getByRole('button', { name: /Week 3: contracts/ }).first()).toBeVisible();

  // a second note, then pinning moves it to the top
  await page.getByRole('button', { name: 'New note' }).click();
  await page.getByRole('dialog').getByLabel('Title').fill('Exam tips');
  await page.getByRole('dialog').getByLabel('Note').fill('Past papers are on the portal.');
  await page.getByRole('dialog').getByRole('button', { name: 'Save note' }).click();
  const firstCardTitle = () => page.locator('ul li').first().innerText();
  expect(await firstCardTitle()).toContain('Exam tips'); // newest first
  await page.getByRole('button', { name: /Pin note Week 3: contracts/ }).click();
  await expect(page.getByRole('button', { name: /Unpin note Week 3: contracts/ })).toHaveAttribute('aria-pressed', 'true');
  expect(await firstCardTitle()).toContain('Week 3: contracts');

  // search and the course filter
  await page.getByLabel('Search notes').fill('portal');
  await expect(page.locator('ul li')).toHaveCount(1);
  await expect(page.getByText('Exam tips').first()).toBeVisible();
  await page.getByLabel('Search notes').fill('zzzz');
  await expect(page.getByText('No notes match')).toBeVisible();
  await page.getByLabel('Search notes').fill('');
  await page.getByLabel('Filter by course').selectOption('LAW 101');
  await expect(page.locator('ul li')).toHaveCount(1);
  await page.getByLabel('Filter by course').selectOption('all');

  // everything survives a reload
  await page.reload();
  await expect(page.locator('ul li')).toHaveCount(2);

  // delete with an undo bar
  await page.getByRole('button', { name: /Exam tips/ }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('status')).toContainText('Deleted “Exam tips”');
  await expect(page.locator('ul li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('ul li')).toHaveCount(2);
  const notes = (await store(page)).notes;
  expect(notes.filter((n) => n.title === 'Exam tips')).toHaveLength(1);
});

test('unsaved text is never lost by accident', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Add your first note' }).click();
  await page.getByRole('dialog').getByLabel('Note').fill('Important thing the lecturer said');
  await page.keyboard.press('Escape');

  // asked first, text still there
  await expect(page.getByRole('alert')).toContainText('not saved');
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByRole('dialog').getByLabel('Note')).toHaveValue('Important thing the lecturer said');

  // only an explicit Discard throws it away
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await store(page)).notes).toHaveLength(0);
});

test('markup in a note is shown as text, never run', async ({ page }) => {
  await ready(page);
  await page.evaluate(() =>
    (window as unknown as { __store: { getState: () => S } }).__store.getState().addNote({ title: '<img src=x onerror="window.__pwned=1">', body: '<script>window.__pwned=1</script> javascript:alert(1)', course: '' })
  );
  await page.getByRole('button', { name: /<img src=x/ }).first().click();
  await expect(page.getByRole('dialog')).toContainText('<script>window.__pwned=1</script>');
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
  expect(await page.getByRole('dialog').getByRole('link').count()).toBe(0);
});

test('the Notes page and both dialog modes have no accessibility violations', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    const s = (window as unknown as { __store: { getState: () => S } }).__store.getState();
    s.addNote({ title: 'Week 3', body: 'See https://example.com', course: 'LAW 101', pinned: true });
  });
  const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
  const scan = async () => (await new AxeBuilder({ page }).withTags(tags).analyze()).violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`);
  expect(await scan()).toEqual([]);
  await page.getByRole('button', { name: /Week 3/ }).first().click();
  expect(await scan()).toEqual([]); // reading view
  await page.getByRole('dialog').getByRole('button', { name: 'Edit' }).click();
  expect(await scan()).toEqual([]); // editor
});

test('notes follow the student to a second device', async ({ browser }) => {
  const email = `notes-${Date.now().toString(36)}@example.com`;
  const signIn = async (page: Page) => {
    const popupPromise = page.waitForEvent('popup');
    void page.evaluate(() => (window as unknown as { __auth: { signInOrLinkWithGoogle: () => Promise<unknown> } }).__auth.signInOrLinkWithGoogle()).catch(() => undefined);
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    const existing = popup.getByText(email, { exact: false });
    if (await existing.count()) {
      await existing.first().click();
    } else {
      await popup.locator('button.mdc-button--outlined').first().click();
      await popup.locator('#autogen-button').click();
      await popup.locator('#email-input').fill(email);
      await popup.locator('#sign-in').click();
    }
    await popup.waitForEvent('close').catch(() => undefined);
    await page.waitForFunction(() => (window as unknown as { __store: { getState: () => S } }).__store.getState().isAnonymous === false);
  };

  const ctx1 = await browser.newContext();
  const p1 = await ctx1.newPage();
  await ready(p1, '/');
  await signIn(p1);
  await p1.evaluate(() => (window as unknown as { __store: { getState: () => S } }).__store.getState().addNote({ title: 'From my laptop', body: 'Synced text', course: 'CS 301', pinned: true }));
  await p1.waitForTimeout(2500);
  await ctx1.close();

  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await ready(p2, '/');
  await signIn(p2);
  const notesOnDevice2 = async () => {
    try {
      return (await store(p2)).notes;
    } catch {
      return []; // the page reloads itself once while the guest records are moved
    }
  };
  await expect.poll(async () => (await notesOnDevice2()).map((n) => n.title), { timeout: 25_000 }).toContain('From my laptop');
  const synced = (await notesOnDevice2()).find((n) => n.title === 'From my laptop')!;
  expect(synced).toMatchObject({ body: 'Synced text', course: 'CS 301', pinned: true });
  await ctx2.close();
});

test('Notes is reachable from the sidebar and the phone navigation', async ({ browser }) => {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const dp = await desktop.newPage();
  await ready(dp, '/');
  await dp.getByRole('link', { name: 'Notes' }).first().click();
  await expect(dp).toHaveURL(/\/notes$/);
  await desktop.close();

  const phone = await browser.newContext({ viewport: { width: 375, height: 760 } });
  const pp = await phone.newPage();
  await ready(pp, '/');
  await pp.getByRole('navigation', { name: 'Mobile Navigation' }).getByRole('link', { name: 'Notes' }).click();
  await expect(pp).toHaveURL(/\/notes$/);
  await expect(pp.getByRole('heading', { name: 'Notes', level: 1 })).toBeVisible();
  await phone.close();
});
