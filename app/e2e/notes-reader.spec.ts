import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

type S = { userId: string | null; addNote: (n: object) => string };
const ready = async (page: Page) => {
  await page.goto('/notes');
  await page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => S } }).__store?.getState().userId);
};

// A tiny but real one-page PDF.
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R/Size 4>>\n%%EOF\n'
);

for (const [label, width, height] of [['desktop', 1280, 800], ['phone', 375, 800]] as const) {
  test(`${label}: a note opens full screen and can hold PDFs that stay on this device`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await ready(page);
    await page.evaluate(() =>
      (window as unknown as { __store: { getState: () => S } }).__store.getState().addNote({
        title: 'Week 3: contract law',
        body: 'Offer, acceptance, consideration.\nSlides: https://example.com/week3.pdf.',
        course: 'LAW 101',
        pinned: false
      })
    );

    await page.getByRole('button', { name: /Week 3: contract law/ }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Read full screen' }).click();

    const reader = page.getByRole('dialog', { name: 'Week 3: contract law' });
    await expect(reader).toBeVisible();
    await expect(reader.getByRole('heading', { level: 1 })).toHaveText('Week 3: contract law');
    await expect(reader.getByRole('link', { name: 'https://example.com/week3.pdf' })).toHaveAttribute('target', '_blank');
    await expect(reader.getByText('No PDFs yet')).toBeVisible();

    // fills the screen and does not scroll sideways
    const box = (await reader.boundingBox())!;
    expect(Math.round(box.width)).toBe(width);
    expect(Math.round(box.height)).toBe(height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations).toEqual([]);

    // something that is not a PDF is refused, even if it is named .pdf
    await reader.locator('input[type=file]').setInputFiles({ name: 'fake.pdf', mimeType: 'application/pdf', buffer: Buffer.from('<html>not a pdf</html>') });
    await expect(reader.getByRole('alert')).toContainText('Only PDF');

    // a real PDF is kept, listed, and opens in the reader
    await reader.locator('input[type=file]').setInputFiles({ name: 'week3-slides.pdf', mimeType: 'application/pdf', buffer: PDF });
    const item = reader.getByRole('button', { name: /week3-slides\.pdf.*tap to read/ });
    await expect(item).toBeVisible();
    await expect(reader.getByRole('alert')).toHaveCount(0);

    // still there after a reload (it is stored on the device)
    await page.reload();
    await page.getByRole('button', { name: /Week 3: contract law/ }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Read full screen' }).click();
    await page.getByRole('dialog').getByRole('button', { name: /week3-slides\.pdf.*tap to read/ }).click();
    await expect(page.locator('iframe[title="week3-slides.pdf"]')).toBeVisible();
    expect(await page.locator('iframe[title="week3-slides.pdf"]').getAttribute('src')).toMatch(/^blob:/);
    await page.getByRole('button', { name: 'Back to note' }).click();

    // removing it asks first, and leaves the note alone
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: /Remove week3-slides\.pdf/ }).click();
    await expect(page.getByText('No PDFs yet')).toBeVisible();
    await expect(page.locator('#note-reader-title')).toHaveText('Week 3: contract law');

    // Escape closes the reader and the note dialog is back
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Read full screen' })).toBeVisible();
    await context.close();
  });
}
