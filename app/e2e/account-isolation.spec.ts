import { expect, test, type BrowserContext, type Page } from '@playwright/test';

type AuthApi = { signInOrLinkWithGoogle: () => Promise<unknown>; signOutUser: () => Promise<void> };

async function boot(page: Page): Promise<void> {
  // After a direct account switch the app reloads itself; a goto that lands in the middle of that
  // reload is aborted by the browser. Retry once the reload has settled.
  for (let attempt = 0; ; attempt++) {
    try {
      await page.goto('/assignments');
      break;
    } catch (err) {
      if (attempt >= 3 || !String(err).includes('ERR_ABORTED')) throw err;
      await page.waitForLoadState('load').catch(() => undefined);
    }
  }
  // Wait for the anonymous session + sync to be bound to a user.
  await page.waitForFunction(() => {
    const s = (window as unknown as { __store?: { getState: () => { userId: string | null } } }).__store;
    return !!s && !!s.getState().userId && !!(window as unknown as { __auth?: unknown }).__auth;
  });
}

/** Drives the Auth emulator's fake Google popup, signing in as the given email. */
async function googleSignIn(page: Page, email: string): Promise<void> {
  const popupPromise = page.waitForEvent('popup');
  void page
    .evaluate(() => (window as unknown as { __auth: AuthApi }).__auth.signInOrLinkWithGoogle())
    .catch((e) => console.log('signInOrLink rejected:', String(e)));
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  const existing = popup.getByText(email, { exact: false });
  if (await existing.count()) {
    await existing.first().click();
  } else {
    await popup.locator('button.mdc-button--outlined').first().click(); // "Add new account"
    await popup.locator('#autogen-button').click();
    await popup.locator('#email-input').fill(email);
    await popup.locator('#sign-in').click();
  }
  await popup.waitForEvent('close').catch(() => undefined);
}

async function currentUid(page: Page): Promise<string | null> {
  return page.evaluate(() => (window as unknown as { __store: { getState: () => { userId: string | null } } }).__store.getState().userId);
}

async function waitForUidChange(page: Page, previous: string | null): Promise<string> {
  await page.waitForFunction(
    (prev) => {
      const id = (window as unknown as { __store: { getState: () => { userId: string | null } } | undefined }).__store?.getState()?.userId;
      return !!id && id !== prev;
    },
    previous
  );
  return (await currentUid(page)) as string;
}

async function waitSignedInWithGoogle(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const s = (window as unknown as { __store: { getState: () => { isAnonymous: boolean; userEmail: string | null } } }).__store.getState();
    return !s.isAnonymous && !!s.userEmail;
  });
}

async function addAssignment(page: Page, title: string): Promise<void> {
  await page.evaluate((t) => {
    (window as unknown as { __store: { getState: () => { addAssignment: (a: unknown) => void } } }).__store
      .getState()
      .addAssignment({ title: t, course: 'TEST 101', dueDate: '2030-01-15', priority: 'medium', status: 'pending', progress: 0 });
  }, title);
}

/** Returns every string the browser holds for this origin: DOM, localStorage, IndexedDB, Cache Storage. */
async function dumpOrigin(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const parts: string[] = ['[dom-text] ' + document.documentElement.innerText, '[dom-html] ' + document.documentElement.outerHTML];
    parts.push('[localStorage] ' + JSON.stringify({ ...localStorage }), '[sessionStorage] ' + JSON.stringify({ ...sessionStorage }));
    if ('caches' in window) {
      for (const k of await caches.keys()) {
        const c = await caches.open(k);
        for (const req of await c.keys()) {
          const res = await c.match(req);
          parts.push('[cache-storage] ' + req.url + (res ? await res.clone().text() : ''));
        }
      }
    }
    const dbs = (await indexedDB.databases?.()) ?? [];
    for (const info of dbs) {
      if (!info.name || info.name.startsWith('firebaseLocalStorage')) continue; // auth token DB holds no student data
      await new Promise<void>((resolve) => {
        const req = indexedDB.open(info.name as string);
        req.onerror = () => resolve();
        req.onsuccess = () => {
          const db = req.result;
          const names = Array.from(db.objectStoreNames);
          if (names.length === 0) {
            db.close();
            return resolve();
          }
          const tx = db.transaction(names, 'readonly');
          let pending = names.length;
          for (const n of names) {
            const all = tx.objectStore(n).getAll();
            all.onsuccess = () => {
              parts.push('[indexeddb:' + info.name + '] ' + JSON.stringify(all.result, (_k, v) => (v instanceof Uint8Array || v instanceof ArrayBuffer ? Array.from(new Uint8Array(v as ArrayBuffer)).map((c) => String.fromCharCode(c)).join('') : v)));
              if (--pending === 0) {
                db.close();
                resolve();
              }
            };
            all.onerror = () => {
              if (--pending === 0) {
                db.close();
                resolve();
              }
            };
          }
        };
      });
    }
    return parts.join('\n');
  });
}

/** Fails with the name of the storage area (dom, localStorage, indexeddb, ...) that still holds `needle`. */
function expectNoTrace(dump: string, needle: string): void {
  const hit = dump.split(/\n(?=\[)/).find((chunk) => chunk.includes(needle));
  expect(hit ? hit.slice(0, 40) : null, `"${needle}" still stored in`).toBeNull();
}

async function newPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  page.on('dialog', (d) => d.dismiss());
  return page;
}

test.describe('account isolation', () => {
  test('sign out, then sign in as another user: nothing from the first user remains', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await newPage(context);
    await boot(page);
    const guestUid = await currentUid(page);

    await googleSignIn(page, 'alice@example.com');
    await waitSignedInWithGoogle(page);
    const aliceUid = (await currentUid(page)) as string;
    expect(aliceUid).toBe(guestUid); // linking keeps the uid
    await addAssignment(page, 'SECRET-ALICE-7f3a');
    await page.goto('/assignments');
    await expect(page.getByText('SECRET-ALICE-7f3a').first()).toBeVisible();
    // let the write reach the emulator before signing out
    await page.waitForFunction(() => !(window as unknown as { __store: { getState: () => { isSyncing: boolean } } }).__store.getState().isSyncing);

    await page.evaluate(() => (window as unknown as { __auth: AuthApi }).__auth.signOutUser());
    await page.waitForLoadState('load');
    await boot(page);
    const afterSignOut = await dumpOrigin(page);
    expectNoTrace(afterSignOut, 'SECRET-ALICE-7f3a');
    expectNoTrace(afterSignOut, aliceUid);

    await googleSignIn(page, 'bob@example.com');
    await waitSignedInWithGoogle(page);
    const bobDump = await dumpOrigin(page);
    expectNoTrace(bobDump, 'SECRET-ALICE-7f3a');
    await context.close();
  });

  test('direct switch between two signed-in users does not leak the first user', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await newPage(context);
    await boot(page);
    await googleSignIn(page, 'carol@example.com');
    await waitSignedInWithGoogle(page);
    const carolUid = (await currentUid(page)) as string;
    await addAssignment(page, 'SECRET-CAROL-91bc');
    await page.waitForFunction(() => !(window as unknown as { __store: { getState: () => { isSyncing: boolean } } }).__store.getState().isSyncing);

    await googleSignIn(page, 'dave@example.com'); // already signed in: this is a direct switch
    await waitForUidChange(page, carolUid);
    await page.waitForLoadState('load');
    await boot(page);
    const dump = await dumpOrigin(page);
    expectNoTrace(dump, 'SECRET-CAROL-91bc');
    await context.close();
  });

  test('anonymous guest links Google: the same records survive (same uid)', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await newPage(context);
    await boot(page);
    const guestUid = await currentUid(page);
    await addAssignment(page, 'GUEST-KEEPME-44de');
    await page.waitForFunction(() => !(window as unknown as { __store: { getState: () => { isSyncing: boolean } } }).__store.getState().isSyncing);

    await googleSignIn(page, 'erin@example.com');
    await waitSignedInWithGoogle(page);
    expect(await currentUid(page)).toBe(guestUid);
    await page.goto('/assignments');
    await expect(page.getByText('GUEST-KEEPME-44de').first()).toBeVisible();
    await context.close();
  });

  test('credential-already-in-use: the guest records are merged into the existing account', async ({ browser }) => {
    // 1) Existing Google account with its own record.
    const first = await browser.newContext();
    const p1 = await newPage(first);
    await boot(p1);
    await googleSignIn(p1, 'frank@example.com');
    await waitSignedInWithGoogle(p1);
    await addAssignment(p1, 'ACCOUNT-OWNED-aa01');
    await p1.waitForFunction(() => !(window as unknown as { __store: { getState: () => { isSyncing: boolean } } }).__store.getState().isSyncing);
    await first.close();

    // 2) A brand-new guest on another device adds a record, then links the same Google account.
    const second = await browser.newContext();
    const p2 = await newPage(second);
    await boot(p2);
    const guestUid = await currentUid(p2);
    await addAssignment(p2, 'GUEST-MERGED-bb02');
    await p2.waitForFunction(() => !(window as unknown as { __store: { getState: () => { isSyncing: boolean } } }).__store.getState().isSyncing);

    await googleSignIn(p2, 'frank@example.com');
    await waitForUidChange(p2, guestUid);
    // the app reloads once the merge is written; locators retry across that navigation
    await expect(p2.getByText('ACCOUNT-OWNED-aa01').first()).toBeVisible({ timeout: 15_000 });
    await expect(p2.getByText('GUEST-MERGED-bb02').first()).toBeVisible({ timeout: 15_000 });
    await second.close();
  });

  test('sign-out in one tab clears the other open tab', async ({ browser }) => {
    const context = await browser.newContext();
    const tab1 = await newPage(context);
    await boot(tab1);
    await googleSignIn(tab1, 'gina@example.com');
    await waitSignedInWithGoogle(tab1);
    await addAssignment(tab1, 'SECRET-GINA-cc03');
    await tab1.waitForFunction(() => !(window as unknown as { __store: { getState: () => { isSyncing: boolean } } }).__store.getState().isSyncing);

    const tab2 = await newPage(context);
    await boot(tab2);
    await expect(tab2.getByText('SECRET-GINA-cc03').first()).toBeVisible({ timeout: 15_000 });

    const reloaded = tab2.waitForEvent('load');
    await tab1.evaluate(() => (window as unknown as { __auth: AuthApi }).__auth.signOutUser());
    await reloaded;
    await boot(tab2);
    expectNoTrace(await dumpOrigin(tab2), 'SECRET-GINA-cc03');
    await context.close();
  });
});
