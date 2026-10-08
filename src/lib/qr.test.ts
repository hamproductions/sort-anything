import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import { buildQr } from './qr';
import type { Qr } from './qr';
import { decodeShared, encodeCompact } from './share';

const scan = (qr: Qr) => {
  const scale = 4;
  const side = (qr.size + 8) * scale;
  const pixels = new Uint8ClampedArray(side * side * 4).fill(255);
  for (const [, x, y] of qr.path.matchAll(/M(\d+) (\d+)/g)) {
    for (let dy = 0; dy < scale; dy++) {
      for (let dx = 0; dx < scale; dx++) {
        const px = ((Number(y) + 4) * scale + dy) * side + (Number(x) + 4) * scale + dx;
        pixels[px * 4] = pixels[px * 4 + 1] = pixels[px * 4 + 2] = 0;
      }
    }
  }
  return jsQR(pixels, side, side)?.data;
};

describe('QR codes', () => {
  const base = 'https://hamproductions.github.io/sort-anything/';

  it('scans back to the exact share link, which opens the same ranking', async () => {
    const items = Array.from({ length: 29 }, (_, i) => ({
      label: `Song ${i + 1} ラブライブ`,
      media: `https://open.spotify.com/track/${String(i).padStart(22, 'A')}`
    }));
    const link = `${base}#/R/${encodeCompact({ title: 'Big list', items, ranking: items.map((_, i) => [i]) })}`;
    const qr = await buildQr(link);
    expect(qr.version).toBeLessThanOrEqual(30);
    const scanned = scan(qr);
    expect(scanned).toBe(link);
    const decoded = decodeShared('R', scanned!.split('#/R/')[1]);
    expect(decoded?.items).toHaveLength(29);
    expect(decoded?.items[28].label).toBe('Song 29 ラブライブ');
  });

  it('falls back to plain text mode for links that are not compact', async () => {
    const link = `${base}#/r/abcDEF`;
    expect(scan(await buildQr(link))).toBe(link);
  });
});
