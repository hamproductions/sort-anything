import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';

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
  for (let i = 0; i < 250; i++) {
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
  expect(link).toMatch(/#\/R\//);

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

const dragHandle = async (page: Page, from: string, to: string) => {
  const source = await page
    .getByRole('button', { name: `Move ${from}`, exact: true })
    .boundingBox();
  const target = await page.getByRole('button', { name: `Move ${to}`, exact: true }).boundingBox();
  await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(
      source!.x + source!.width / 2,
      source!.y + ((target!.y - source!.y) * i) / 10 + source!.height / 2
    );
  }
  await page.mouse.up();
  await page.waitForTimeout(100);
};

test('items reorder by dragging the handle and by keyboard', async ({ page }) => {
  await page.goto('./');
  await pasteList(page, 'One\nTwo\nThree\nFour');
  await dragHandle(page, 'Four', 'One');
  await expect.poll(() => listLabels(page)).toEqual(['Four', 'One', 'Two', 'Three']);

  await page.getByRole('button', { name: 'Move One', exact: true }).focus();
  for (const key of ['Space', 'ArrowDown', 'ArrowDown', 'Space']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(150);
  }
  await expect.poll(() => listLabels(page)).toEqual(['Four', 'Two', 'Three', 'One']);
});

test('items reorder by touch on a phone', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  });
  const page = await context.newPage();
  await page.goto('./');
  await pasteList(page, 'One\nTwo\nThree\nFour');
  const source = await page.getByRole('button', { name: 'Move Four', exact: true }).boundingBox();
  const target = await page.getByRole('button', { name: 'Move One', exact: true }).boundingBox();
  const x = source!.x + source!.width / 2;
  const fromY = source!.y + source!.height / 2;
  const toY = target!.y + target!.height / 2;
  const cdp = await context.newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', y: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y }]
    });
  await touch('touchStart', fromY);
  for (let i = 1; i <= 10; i++) await touch('touchMove', fromY + ((toY - fromY) * i) / 10);
  await touch('touchEnd', toY);
  await expect.poll(() => listLabels(page)).toEqual(['Four', 'One', 'Two', 'Three']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await context.close();
});

test('adjust order drags a result into place and breaks it out of a tie', async ({ page }) => {
  await page.goto('./');
  await pasteList(page, 'A\nB\nC\nD');
  await page.evaluate(() => localStorage.setItem('sa:shuffle', 'false'));
  await page.getByRole('button', { name: 'Start sorting' }).click();
  await expect(page.locator('.faceoff')).toBeVisible();
  const order = ['A', 'B', 'C', 'D'];
  for (let i = 0; i < 20 && !page.url().includes('#/done/'); i++) {
    const left = await page.locator('.side-left .side-label').first().textContent();
    const right = await page.locator('.side-right .side-label').first().textContent();
    await page.keyboard.press(
      order.indexOf(left!) < order.indexOf(right!) ? 'ArrowLeft' : 'ArrowRight'
    );
    await page.waitForTimeout(260);
  }
  await expect(page).toHaveURL(/#\/done\//);
  expect(await rankedLabels(page)).toEqual(['A', 'B', 'C', 'D']);

  await page.getByRole('button', { name: 'Adjust order' }).click();
  await dragHandle(page, 'D', 'A');
  await expect.poll(() => rankedLabels(page)).toEqual(['D', 'A', 'B', 'C']);
  await page.getByRole('button', { name: 'Tie with above' }).nth(1).click();
  await expect(page.locator('.rank-list .rank-num')).toHaveText(['1', '2', '4']);
  await dragHandle(page, 'B', 'D');
  await expect.poll(() => rankedLabels(page)).toEqual(['B', 'D', 'A', 'C']);
  await expect(page.locator('.rank-list .rank-num')).toHaveText(['1', '2', '3', '4']);
});

test('about explains local storage and links to GitHub', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'About' }).click();
  const dialog = page.getByRole('dialog', { name: 'About Sort Anything' });
  await expect(dialog).toContainText('saved in this browser only');
  await expect(dialog.getByRole('link', { name: 'Source code on GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/hamproductions/sort-anything'
  );
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('the QR code scans to a link that opens the ranking', async ({ page, browser }) => {
  test.setTimeout(120_000);
  await page.goto('./');
  await page.getByLabel('Ranking name').fill('QR test');
  const ids = Array.from({ length: 29 }, (_, i) => `${i}`.padStart(2, '0').repeat(11));
  await pasteList(
    page,
    ids
      .map((id, i) => `Song ${29 - i} ラブライブ | https://open.spotify.com/track/${id}`)
      .join('\n')
  );
  await page.getByRole('button', { name: 'Start sorting' }).click();
  await sortByNumber(page);

  await expect(page.locator('.results-qr')).toBeVisible();
  await page.getByRole('button', { name: 'QR code' }).click();
  const big = page.locator('.qr-big');
  await expect(big).toBeVisible();
  const png = PNG.sync.read(await big.screenshot());
  const scanned = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data;
  expect(scanned).toMatch(/^http:\/\/localhost:\d+\/#\/R\//);

  const friend = await browser.newContext();
  const other = await friend.newPage();
  await other.goto(scanned!);
  await expect(other.locator('.results-title')).toHaveText('QR test');
  expect(await rankedLabels(other)).toEqual(
    Array.from({ length: 29 }, (_, i) => `Song ${i + 1} ラブライブ`)
  );
  await friend.close();

  await page.keyboard.press('Escape');
  await expect(big).toHaveCount(0);
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

test('a list copied as plain text from Discord gets its songs and pictures back', async ({
  page
}) => {
  await page.goto('./');
  await pasteList(
    page,
    'Song 2 | https://example.com/two.png\nSong 1 | https://example.com/one.png\nSong 3'
  );
  await page.getByRole('button', { name: 'Start sorting' }).click();
  await sortByNumber(page);
  await expect(page.locator('.results-title-input')).toHaveValue('');

  await page.goto('./');
  await page.getByRole('button', { name: 'Clear list' }).click();
  await pasteList(
    page,
    'Untitled ranking\n1. Song 1\n2. Song 2\n3. Song 3\nSorted with Sort Anything'
  );
  await expect(page.locator('.toast')).toContainText('songs restored for 2');
  await expect(page.getByLabel('Ranking name')).toHaveValue('');
  expect(await listLabels(page)).toEqual(['Song 1', 'Song 2', 'Song 3']);
  await expect(page.locator('.item-rank')).toHaveText(['1', '2', '3']);
  await expect(page.locator('.item-row').nth(0).locator('img')).toHaveAttribute(
    'src',
    'https://example.com/one.png'
  );
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
