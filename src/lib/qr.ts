export type Qr = { path: string; size: number; version: number };

const ALPHANUMERIC = /^[0-9A-Z $%*+\-./:]+$/;

export const buildQr = async (link: string): Promise<Qr> => {
  const { create } = await import('qrcode');
  const hash = link.indexOf('#');
  const rest = hash >= 0 ? link.slice(hash + 1) : '';
  const segments =
    hash >= 0 && ALPHANUMERIC.test(rest)
      ? [
          { data: new TextEncoder().encode(link.slice(0, hash + 1)), mode: 'byte' as const },
          { data: rest, mode: 'alphanumeric' as const }
        ]
      : [{ data: new TextEncoder().encode(link), mode: 'byte' as const }];
  const code = create(segments, { errorCorrectionLevel: 'L' });
  const { size, data } = code.modules;
  let path = '';
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (data[row * size + col]) path += `M${col} ${row}h1v1h-1z`;
    }
  }
  return { path, size, version: code.version };
};
