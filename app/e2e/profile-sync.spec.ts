import { expect, test, type Page } from '@playwright/test';

type S = {
  userId: string | null;
  isAnonymous: boolean;
  user: { name: string; university: string; semester: string; semesterStart?: string };
  customPhotoUrl: string | null;
  updateUser: (u: object) => void;
  setCustomPhoto: (u: string | null) => void;
};
// The app reloads itself once while the guest records are moved, so reading can briefly fail: retry through it.
async function store(page: Page): Promise<S> {
  for (let i = 0; i < 30; i++) {
    try {
      return await page.evaluate(() => (window as unknown as { __store: { getState: () => S } }).__store.getState());
    } catch {
      await page.waitForTimeout(250);
    }
  }
  throw new Error('The store never became available');
}

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => S } }).__store?.getState().userId);
}

async function googleSignIn(page: Page, email: string): Promise<void> {
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
}

test('the profile and chosen picture follow the student to a second device', async ({ browser }) => {
  const email = `profile-${Date.now().toString(36)}@example.com`;

  // device 1: sign in, fill in the profile, choose a picture
  const ctx1 = await browser.newContext();
  const p1 = await ctx1.newPage();
  await boot(p1);
  await googleSignIn(p1, email);
  await p1.waitForFunction(() => (window as unknown as { __store: { getState: () => S } }).__store.getState().isAnonymous === false);
  const photo = await p1.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 48;
    c.height = 48;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#16a34a';
    ctx.fillRect(0, 0, 48, 48);
    return c.toDataURL('image/jpeg', 0.8);
  });
  await p1.evaluate(
    ({ photo }) => {
      const s = (window as unknown as { __store: { getState: () => S } }).__store.getState();
      s.updateUser({ name: 'Amina Wanjiru', university: 'University of Nairobi', semester: 'Semester 1, 2026', semesterStart: '2026-09-07' });
      s.setCustomPhoto(photo);
    },
    { photo }
  );
  await p1.waitForTimeout(2500); // let the writes reach the emulator
  await ctx1.close();

  // device 2: a clean browser signs in to the same account
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await boot(p2);
  await googleSignIn(p2, email);
  await expect.poll(async () => (await store(p2)).user.name, { timeout: 20_000 }).toBe('Amina Wanjiru');
  const s2 = await store(p2);
  expect(s2.user.university).toBe('University of Nairobi');
  expect(s2.user.semester).toBe('Semester 1, 2026');
  expect(s2.user.semesterStart).toBe('2026-09-07');
  expect(s2.customPhotoUrl).toBe(photo);
  await ctx2.close();
});

test('removing the picture on one device removes it from the account', async ({ browser }) => {
  const email = `photo-${Date.now().toString(36)}@example.com`;
  const ctx1 = await browser.newContext();
  const p1 = await ctx1.newPage();
  await boot(p1);
  await googleSignIn(p1, email);
  await p1.waitForFunction(() => (window as unknown as { __store: { getState: () => S } }).__store.getState().isAnonymous === false);
  await p1.evaluate(() => (window as unknown as { __store: { getState: () => S } }).__store.getState().setCustomPhoto('data:image/jpeg;base64,/9j/4AAQSkZJRg=='));
  await p1.waitForTimeout(1500);
  await p1.evaluate(() => (window as unknown as { __store: { getState: () => S } }).__store.getState().setCustomPhoto(null));
  await p1.waitForTimeout(2000);
  await ctx1.close();

  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await boot(p2);
  await googleSignIn(p2, email);
  await p2.waitForFunction(() => (window as unknown as { __store: { getState: () => S } }).__store.getState().isAnonymous === false);
  await p2.waitForTimeout(3000);
  expect((await store(p2)).customPhotoUrl).toBeNull();
  await ctx2.close();
});
