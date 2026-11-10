import { expect, test, type Page } from '@playwright/test';

type S = { userId: string | null; sessions: Array<{ dayOfWeek: number; title: string }>; addSession: (s: object) => void };
const ready = async (page: Page) => {
  await page.goto('/calendar');
  await page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => S } }).__store?.getState().userId);
};

test('two blocks at the same day and time show a warning, but can still be added', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await ready(page);
  await page.evaluate(() =>
    (window as unknown as { __store: { getState: () => S } }).__store.getState().addSession({
      title: 'Distributed Systems', course: 'ACS443', dayOfWeek: 3, startTime: '10:00', endTime: '11:30', type: 'lecture'
    })
  );

  await page.getByRole('button', { name: 'Add Block' }).first().click();
  await page.getByPlaceholder('e.g. Distributed Systems Lab').fill('Differential Calculus');
  await page.getByPlaceholder('e.g. CS 101').fill('MAT344');
  await page.getByLabel('Day of the week').selectOption({ label: 'Wed' });
  await expect(page.getByRole('status')).toContainText('clashes with Distributed Systems (10:00-11:30)');

  // the warning does not stop the student
  await page.locator('form').getByRole('button', { name: 'Add Block' }).click();
  await expect(page.getByText('Clashes with another block')).toHaveCount(2);
});

test('an end time that is not after the start time is refused', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await ready(page);
  await page.getByRole('button', { name: 'Add Block' }).first().click();
  await page.getByPlaceholder('e.g. Distributed Systems Lab').fill('Backwards');
  await page.getByPlaceholder('e.g. CS 101').fill('XYZ1');
  await page.getByLabel('Start time').fill('12:00');
  await page.getByLabel('End time').fill('11:00');
  await expect(page.getByRole('alert')).toContainText('end time must be after');
  await page.locator('form').getByRole('button', { name: 'Add Block' }).click();
  expect(await page.evaluate(() => (window as unknown as { __store: { getState: () => S } }).__store.getState().sessions.length)).toBe(0);
});

test('a Sunday block is saved as day 0 and shows in the Sunday column', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await ready(page);
  await page.getByRole('button', { name: 'Add Block' }).first().click();
  await page.getByPlaceholder('e.g. Distributed Systems Lab').fill('Sunday revision');
  await page.getByPlaceholder('e.g. CS 101').fill('REV1');
  await page.getByLabel('Day of the week').selectOption({ label: 'Sun' });
  await page.locator('form').getByRole('button', { name: 'Add Block' }).click();

  const s = await page.evaluate(() => (window as unknown as { __store: { getState: () => S } }).__store.getState().sessions);
  expect(s.map((x) => [x.title, x.dayOfWeek])).toEqual([['Sunday revision', 0]]);
  await expect(page.getByRole('button', { name: /Edit .*Sunday revision/ })).toBeVisible();
});

for (const [label, width] of [['desktop', 1280], ['phone', 375]] as const) {
  test(`${label}: tapping a block edits its time, and a clash goes away once the times differ`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await ready(page);
    await page.evaluate(() => {
      const st = (window as unknown as { __store: { getState: () => S } }).__store.getState();
      st.addSession({ title: 'Distributed Systems', course: 'ACS443', dayOfWeek: 3, startTime: '10:00', endTime: '11:30', type: 'lecture' });
      st.addSession({ title: 'Differential Calculus', course: 'MAT344', dayOfWeek: 3, startTime: '10:00', endTime: '11:30', type: 'lecture' });
    });
    await expect(page.getByText('Clashes with another block')).toHaveCount(2);

    await page.getByRole('button', { name: /Edit .*Distributed Systems/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit block' });
    await expect(dialog).toBeVisible();
    // it is filled with the block's own details, and warns about the OTHER block only
    await expect(dialog.getByPlaceholder('e.g. Distributed Systems Lab')).toHaveValue('Distributed Systems');
    await expect(dialog.getByLabel('Start time')).toHaveValue('10:00');
    await expect(dialog.getByRole('status')).toContainText('Differential Calculus');
    await expect(dialog.getByRole('status')).not.toContainText('Distributed Systems');

    await dialog.getByLabel('Start time').fill('13:00');
    await dialog.getByLabel('End time').fill('14:30');
    await expect(dialog.getByRole('status')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await expect(page.getByText('Clashes with another block')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Edit .*Distributed Systems.*13:00 - 14:30/ })).toBeVisible();
    const times = async () =>
      page.evaluate(() => (window as unknown as { __store: { getState: () => { sessions: Array<{ title: string; startTime: string; endTime: string }> } } }).__store.getState().sessions.map((x) => `${x.title} ${x.startTime}-${x.endTime}`));
    await expect.poll(async () => (await times()).sort()).toEqual(['Differential Calculus 10:00-11:30', 'Distributed Systems 13:00-14:30']);

    // wait until the change has reached the database, as it would within a moment in real use
    const uid = await page.evaluate(() => (window as unknown as { __store: { getState: () => S } }).__store.getState().userId);
    await expect
      .poll(async () => {
        const res = await page.request.get(`http://127.0.0.1:8080/v1/projects/studyflow-e2e/databases/(default)/documents/users/${uid}/sessions`, {
          headers: { Authorization: 'Bearer owner' }
        });
        return JSON.stringify(await res.json()).includes('13:00');
      })
      .toBe(true);

    // the change is kept after a reload
    await page.reload();
    await page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => S } }).__store?.getState().userId);
    await expect(page.getByRole('button', { name: /Edit .*Distributed Systems.*13:00 - 14:30/ })).toBeVisible();

    // a block can also be deleted from its edit dialog
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: /Edit .*Differential Calculus/ }).click();
    await page.getByRole('dialog', { name: 'Edit block' }).getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('button', { name: /Edit .*Differential Calculus/ })).toHaveCount(0);
  });
}
