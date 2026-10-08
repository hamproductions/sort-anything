import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const pasteList = async (page: Page, text: string) => {
  const box = page.getByLabel('Add items');
  await box.fill(text);
  await box.press('Enter');
};

const listLabels = (page: Page) =>
  page
    .locator('.item-label')
    .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));

const numberOf = (label: string) => Number(label.match(/[\d.]+/)?.[0]);

const pickCount = async (page: Page) =>
  Number((await page.locator('.sorter-stats').textContent())?.match(/Pick (\d+)/)?.[1] ?? 0);

const sortByNumber = async (page: Page) => {
  for (let i = 0; i < 80; i++) {
    if (page.url().includes('#/done/')) return;
    const left = await page.locator('.side-left .side-label').first().textContent();
    const right = await page.locator('.side-right .side-label').first().textContent();
    const before = await pickCount(page);
    await page.keyboard.press(numberOf(left!) < numberOf(right!) ? 'ArrowLeft' : 'ArrowRight');
    await expect
      .poll(async () => page.url().includes('#/done/') || (await pickCount(page)) > before)
      .toBe(true);
  }
  throw new Error('sorting did not finish');
};

const rankedLabels = (page: Page) =>
  page
    .locator('.rank-list .rank-label')
    .evaluateAll((spans) => spans.map((span) => span.textContent));

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

test('builds a list: paste, rename, remove with undo, edit as text', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText('Nothing to sort yet')).toBeVisible();

  await pasteList(page, '# Snacks\nChips\nPocky\nOreo\nchips');
  await expect(page.getByLabel('Ranking name')).toHaveValue('Snacks');
  expect(await listLabels(page)).toEqual(['Chips', 'Pocky', 'Oreo']);
  await expect(page.locator('.toast')).toContainText('Added 3 items');

  const second = page.locator('.item-label').nth(1);
  await second.fill('Pocky Strawberry');
  await second.press('Enter');

  await page.getByRole('button', { name: 'Remove Oreo' }).click();
  expect(await listLabels(page)).toEqual(['Chips', 'Pocky Strawberry']);
  await page.locator('.toast-action').click();
  expect(await listLabels(page)).toEqual(['Chips', 'Pocky Strawberry', 'Oreo']);

  await page.getByRole('button', { name: 'Edit as text' }).click();
  const text = page.getByLabel('List as text');
  await expect(text).toHaveValue('Chips\nPocky Strawberry\nOreo');
  await text.fill('Chips\nPocky Strawberry\nOreo\nGum | https://example.com/gum.png');
  await page.getByRole('button', { name: 'Apply changes' }).click();
  expect(await listLabels(page)).toEqual(['Chips', 'Pocky Strawberry', 'Oreo', 'Gum']);
  await expect(page.locator('.item-row').nth(3).locator('img')).toHaveAttribute(
    'src',
    'https://example.com/gum.png'
  );

  await page.reload();
  expect(await listLabels(page)).toEqual(['Chips', 'Pocky Strawberry', 'Oreo', 'Gum']);
});

test('sorts correctly with the keyboard and fills the progress bar', async ({ page }) => {
  await page.goto('./');
  await pasteList(
    page,
    ['5', '3', '8', '1', '7', '2', '6', '4'].map((n) => `Song ${n}`).join('\n')
  );
  await page.getByRole('button', { name: 'Start sorting' }).click();
  await expect(page).toHaveURL(/#\/s\//);

  const left = await page.locator('.side-left .side-label').textContent();
  const right = await page.locator('.side-right .side-label').textContent();
  await page.keyboard.press(numberOf(left!) < numberOf(right!) ? 'ArrowLeft' : 'ArrowRight');
  await expect(page.locator('.sorter-stats')).toContainText('Pick 2');
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('.sorter-stats')).toContainText('Pick 1');

  for (let i = 0; i < 6; i++) {
    const l = await page.locator('.side-left .side-label').textContent();
    const r = await page.locator('.side-right .side-label').textContent();
    const before = await pickCount(page);
    await page.keyboard.press(numberOf(l!) < numberOf(r!) ? 'ArrowLeft' : 'ArrowRight');
    await expect.poll(() => pickCount(page)).toBeGreaterThan(before);
  }
  const fill = await page
    .locator('.progress span')
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(fill).toBeGreaterThan(50);

  await sortByNumber(page);
  await expect(page).toHaveURL(/#\/done\//);
  expect(await rankedLabels(page)).toEqual(
    ['1', '2', '3', '4', '5', '6', '7', '8'].map((n) => `Song ${n}`)
  );
  await expect(page.locator('.results-sub')).toContainText('8 items ranked');
});

test('ties share a rank', async ({ page }) => {
  await page.goto('./');
  await pasteList(page, 'Red\nGreen\nBlue');
  await page.getByRole('button', { name: 'Start sorting' }).click();
  for (let i = 0; i < 10 && !page.url().includes('#/done/'); i++) {
    const before = await pickCount(page);
    await page.keyboard.press('ArrowDown');
    await expect
      .poll(async () => page.url().includes('#/done/') || (await pickCount(page)) > before)
      .toBe(true);
  }
  await expect(page.locator('.rank-list > li')).toHaveCount(1);
  await expect(page.locator('.tie-tag')).toHaveCount(3);
});

test('copy list pastes back and places only the new item', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Ranking name').fill('Numbers');
  await pasteList(page, 'Song 3\nSong 1\nSong 4\nSong 2');
  await page.getByRole('button', { name: 'Start sorting' }).click();
  await sortByNumber(page);

  await page.getByRole('button', { name: 'Copy list' }).click();
  await expect(page.locator('.toast')).toContainText('List copied');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const lines = copied.split('\n');
  expect(lines.slice(0, 5)).toEqual([
    '## Numbers',
    '**1.** Song 1',
    '**2.** Song 2',
    '**3.** Song 3',
    '**4.** Song 4'
  ]);
  expect(lines[5]).toMatch(/^-# Sorted with \[Sort Anything\]\(<http:\/\/localhost:\d+\/>\)$/);

  await page.goto('./');
  await page.getByRole('button', { name: 'Clear list' }).click();
  await pasteList(page, `${copied}\nSong 2.5`);
  await expect(page.getByLabel('Ranking name')).toHaveValue('Numbers');
  await expect(page.locator('.item-rank')).toHaveText(['1', '2', '3', '4', 'new']);
  await expect(page.getByRole('button', { name: 'Place the 1 new' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await page.getByRole('button', { name: 'Start sorting' }).click();
  await sortByNumber(page);
  expect(await rankedLabels(page)).toEqual(['Song 1', 'Song 2', 'Song 2.5', 'Song 3', 'Song 4']);
  await expect(page.locator('.results-sub')).toContainText('in 2 picks');
});

test('share link shows the ranking to someone else', async ({ page, browser }) => {
  await page.goto('./');
  await page.getByLabel('Ranking name').fill('Shared');
  await pasteList(page, 'Song 2\nSong 1\nSong 3');
  await page.getByRole('button', { name: 'Start sorting' }).click();
  await sortByNumber(page);

  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Copy share link' }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/#\/r\//);

  const friend = await browser.newContext();
  const other = await friend.newPage();
  await other.goto(link);
  await expect(other.getByText('Someone shared their ranking with you.')).toBeVisible();
  await expect(other.locator('.results-title')).toHaveText('Shared');
  expect(await rankedLabels(other)).toEqual(['Song 1', 'Song 2', 'Song 3']);
  await other.getByRole('button', { name: 'Sort this list yourself' }).click();
  await expect(other).toHaveURL(/#\/s\//);
  await expect(other.locator('.side-label')).toHaveCount(2);
  await friend.close();
});

test('recap plays through to the end and closes', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Ranking name').fill('Recap test');
  await pasteList(page, 'Song 4\nSong 2\nSong 1\nSong 3');
  await page.getByRole('button', { name: 'Start sorting' }).click();
  await sortByNumber(page);

  await page.getByRole('button', { name: 'Play recap' }).click();
  await expect(page.locator('.recap-backdrop')).toBeVisible();
  await expect(page.locator('.recap-wait')).toHaveCount(0);
  const segments = await page.locator('.recap-segments > span').count();
  expect(segments).toBeGreaterThanOrEqual(6);

  await expect
    .poll(() =>
      page
        .locator('.recap-segments > span > span')
        .first()
        .evaluate((el) => parseFloat((el as HTMLElement).style.width))
    )
    .toBeGreaterThan(0);

  for (let i = 0; i < segments; i++) await page.keyboard.press('ArrowRight');
  await expect(page.locator('.recap-end')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Watch again' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('.recap-backdrop')).toHaveCount(0);
});

test('my rankings lists finished and unfinished sorts', async ({ page }) => {
  await page.goto('./');
  await pasteList(page, 'A\nB\nC\nD');
  await page.getByRole('button', { name: 'Start sorting' }).click();
  await expect(page.locator('.faceoff')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#\/$/);
  await page.getByRole('button', { name: /My rankings/ }).click();
  await expect(page.locator('.menu-panel li')).toHaveCount(1);
  await expect(page.locator('.menu-meta')).toContainText('sorted');
  await page.locator('.menu-panel li a').click();
  await expect(page).toHaveURL(/#\/s\//);
  await expect(page.locator('.sorter-stats')).toContainText('Pick 2');
});

test('help page explains copying from Discord', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'How to use', exact: true }).click();
  await expect(page).toHaveURL(/#\/help$/);
  await expect(page.getByRole('heading', { name: 'Copy a list from Discord' })).toBeVisible();
  await expect(page.getByText('Copy Text').first()).toBeVisible();
});

test('the sorter fits a phone screen without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await pasteList(
    page,
    'ひっさつマイマイモード (Extended Club Mix featuring Everyone)\n二人はいつでもHappy End\nShort'
  );
  await page.getByRole('button', { name: 'Start sorting' }).click();
  await expect(page.locator('.faceoff')).toBeVisible();
  const size = await page.evaluate(() => ({
    scroll: document.documentElement.scrollHeight,
    height: window.innerHeight,
    width: document.documentElement.scrollWidth
  }));
  expect(size.scroll).toBeLessThanOrEqual(size.height);
  expect(size.width).toBeLessThanOrEqual(390);
  await expect(page.getByRole('button', { name: /Tie/ })).toBeInViewport();
});
