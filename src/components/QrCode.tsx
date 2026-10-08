import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { buildQr } from '~/lib/qr';
import type { Qr } from '~/lib/qr';

export const useQr = (link: string | undefined) => {
  const [qr, setQr] = useState<{ link: string; qr: Qr }>();
  useEffect(() => {
    if (!link) return;
    let cancelled = false;
    void buildQr(link).then((result) => {
      if (!cancelled) setQr({ link, qr: result });
    });
    return () => {
      cancelled = true;
    };
  }, [link]);
  return qr && qr.link === link ? qr.qr : undefined;
};

export const QrSvg = ({
  qr,
  className,
  label,
  style
}: {
  qr: Qr;
  className?: string;
  label: string;
  style?: CSSProperties;
}) => (
  <svg
    className={className}
    style={style}
    viewBox={`-4 -4 ${qr.size + 8} ${qr.size + 8}`}
    role="img"
    aria-label={label}
    shapeRendering="crispEdges"
  >
    <rect x={-4} y={-4} width={qr.size + 8} height={qr.size + 8} fill="#fff" />
    <path d={qr.path} fill="#12152a" />
  </svg>
);
