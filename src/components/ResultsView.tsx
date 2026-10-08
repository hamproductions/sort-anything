import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { moveInRanking, rankGroups, toCsv, toPasteList, toPlainText } from '~/lib/format';
import { baseUrl, listLink, resultLink, toSharedList } from '~/lib/share';
import { useDocumentTitle, usePersistentState } from '~/lib/hooks';
import type { Item } from '~/lib/types';
import { useToast } from './Toast';
import type { RecapStats } from '~/recap/RecapPlayer';
import { QrSvg, useQr } from './QrCode';
import type { Qr } from '~/lib/qr';
import { MediaThumb, Thumb, useItemImage } from './MediaPlayer';
import { DragHandle, SortableList, useSortableRow } from './Sortable';

const RecapPlayer = lazy(() =>
  import('~/recap/RecapPlayer').then((module) => ({ default: module.RecapPlayer }))
);

const TileImage = ({ item }: { item: Item }) => {
  const src = useItemImage(item, 'small');
  if (item.media) return <MediaThumb item={item} className="tile-thumb" />;
  return src ? (
    <Thumb src={src} />
  ) : (
    <span className="tile-fallback">{item.label.slice(0, 1)}</span>
  );
};

type Layout = 'list' | 'grid';

const tieWithAbove = (groups: string[][], id: string) => {
  const gi = groups.findIndex((g) => g.includes(id));
  if (gi <= 0) return groups;
  const next = groups.map((g) => [...g]);
  next[gi] = next[gi].filter((x) => x !== id);
  next[gi - 1].push(id);
  return next.filter((g) => g.length > 0);
};

const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '') || 'ranking';

export const ResultsView = ({
  title,
  items,
  groups,
  subtitle,
  onTitleChange,
  onGroupsChange,
  actions,
  stats
}: {
  title: string;
  items: Item[];
  groups: string[][];
  subtitle?: ReactNode;
  onTitleChange?: (title: string) => void;
  onGroupsChange?: (groups: string[][]) => void;
  actions?: ReactNode;
  stats?: RecapStats;
}) => {
  const toast = useToast();
  useDocumentTitle(title);
  const captureRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = usePersistentState<Layout>('sa:layout', 'list');
  const [adjusting, setAdjusting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const ranked = useMemo(() => rankGroups(groups, items), [groups, items]);
  const hasImages = items.some((item) => item.image || item.media);
  const effectiveLayout = hasImages ? layout : 'list';

  const shared = () => toSharedList(title, items, groups);
  const shareLink = useMemo(
    () => resultLink(toSharedList(title, items, groups)),
    [title, items, groups]
  );
  const qr = useQr(shareLink);
  const [showQr, setShowQr] = useState(false);

  const copy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(message);
    } catch {
      toast('Copy was blocked by the browser. Select and copy manually.');
    }
  };

  const renderImage = async () => {
    if (!captureRef.current) return;
    setBusy(true);
    try {
      const { domToBlob } = await import('modern-screenshot');
      return await domToBlob(captureRef.current, {
        scale: 2,
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        filter: (node) => !(node instanceof HTMLElement && node.dataset.noCapture !== undefined)
      });
    } catch {
      toast('Couldn’t render the image. Some pictures may block downloads.');
    } finally {
      setBusy(false);
    }
  };

  const saveImage = async () => {
    const blob = await renderImage();
    if (blob) {
      download(blob, `${slug(title)}.png`);
      toast('Image saved');
    }
  };

  const nativeShare = async () => {
    const url = resultLink(shared());
    try {
      await navigator.share({ title, text: toPlainText(title, ranked, undefined, 5), url });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') void copy(url, 'Link copied');
    }
  };

  const canNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

  useEffect(() => {
    if (!moreOpen) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === 'Escape'
          : !moreRef.current?.contains(event.target as Node)
      )
        setMoreOpen(false);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
    };
  }, [moreOpen]);

  return (
    <div className="results">
      <div className="results-capture" ref={captureRef}>
        <div className="results-head">
          {onTitleChange && <h1 className="sr-only">{title || 'Your ranking'}</h1>}
          {onTitleChange ? (
            <input
              className="results-title-input"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              aria-label="Ranking title"
              placeholder="Add a title"
              maxLength={120}
            />
          ) : (
            title && <h1 className="results-title">{title}</h1>
          )}
          {subtitle && <p className="muted results-sub">{subtitle}</p>}
        </div>

        <div className="results-toolbar" data-no-capture>
          <div className="row wrap">
            <button
              className="primary"
              onClick={() =>
                void copy(
                  toPasteList(title, ranked, baseUrl()),
                  'List copied. Paste it into a new sort.'
                )
              }
            >
              Copy list
            </button>
            <button disabled={busy} onClick={() => void saveImage()}>
              {busy ? 'Rendering…' : 'Save image'}
            </button>
            <button onClick={() => setRevealing(true)}>Play recap</button>
            <button onClick={() => setShowQr(true)}>QR code</button>
            <div className="menu" ref={moreRef}>
              <button
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((o) => !o)}
              >
                More
              </button>
              {moreOpen && (
                <div
                  className="menu-panel menu-actions"
                  role="menu"
                  onClick={() => setMoreOpen(false)}
                >
                  {canNativeShare && (
                    <button role="menuitem" onClick={() => void nativeShare()}>
                      Share…
                    </button>
                  )}
                  <button
                    role="menuitem"
                    onClick={() => void copy(resultLink(shared()), 'Share link copied')}
                  >
                    Copy share link
                  </button>
                  <button
                    role="menuitem"
                    onClick={() =>
                      void copy(
                        listLink(shared()),
                        'Link copied. Friends get the same list to sort.'
                      )
                    }
                  >
                    Copy link for friends to sort
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => void copy(toPlainText(title, ranked), 'Names copied')}
                  >
                    Copy names only
                  </button>
                  <button
                    role="menuitem"
                    onClick={() =>
                      download(
                        new Blob([toCsv(ranked)], { type: 'text/csv' }),
                        `${slug(title)}.csv`
                      )
                    }
                  >
                    Download CSV
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="row wrap">
            {onGroupsChange && effectiveLayout === 'list' && (
              <button
                className="small ghost"
                aria-pressed={adjusting}
                onClick={() => setAdjusting((a) => !a)}
              >
                {adjusting ? 'Done adjusting' : 'Adjust order'}
              </button>
            )}
            {hasImages && (
              <div className="segmented" role="group" aria-label="Layout">
                <button aria-pressed={layout === 'list'} onClick={() => setLayout('list')}>
                  List
                </button>
                <button aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')}>
                  Grid
                </button>
              </div>
            )}
          </div>
        </div>

        {revealing && (
          <Suspense
            fallback={
              <div className="recap-backdrop">
                <div className="recap-wait">Loading your recap…</div>
              </div>
            }
          >
            <RecapPlayer
              title={title}
              ranked={ranked}
              stats={stats}
              qr={qr}
              onClose={() => setRevealing(false)}
            />
          </Suspense>
        )}

        {effectiveLayout === 'grid' ? (
          <ol className="rank-grid">
            {ranked.flatMap(({ rank, items }) =>
              items.map((item) => (
                <li
                  key={item.id}
                  className={`reveal-row${rank <= 3 ? ` top top-${rank}` : ''}`}
                  style={
                    { '--i': Math.max(0, Math.min(14, ranked.length - rank)) } as CSSProperties
                  }
                >
                  <div className="tile-image">
                    <TileImage item={item} />
                    <span className="tile-rank">{rank}</span>
                  </div>
                  <span className="tile-label">{item.label}</span>
                </li>
              ))
            )}
          </ol>
        ) : (
          <SortableList
            ids={ranked.flatMap(({ items }) => items.map((item) => item.id))}
            onMove={(from, to) =>
              onGroupsChange?.(
                moveInRanking(groups, ranked.flatMap(({ items }) => items)[from].id, to)
              )
            }
          >
            <ol className="rank-list">
              {ranked.map(({ rank, items }, gi) => (
                <li
                  key={gi}
                  className={`reveal-row${rank <= 3 ? ` top top-${rank}` : ''}`}
                  style={
                    { '--i': Math.max(0, Math.min(14, ranked.length - 1 - gi)) } as CSSProperties
                  }
                >
                  <span className="rank-num" aria-label={`Rank ${rank}`}>
                    {rank}
                  </span>
                  <div className="rank-items">
                    {items.map((item) => (
                      <RankItem
                        key={item.id}
                        item={item}
                        tied={items.length > 1}
                        placeholder={hasImages}
                        adjusting={adjusting && !!onGroupsChange}
                        onTieWithAbove={
                          gi > 0 && onGroupsChange
                            ? () => onGroupsChange(tieWithAbove(groups, item.id))
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </SortableList>
        )}
        <div className="results-foot">
          {qr && (
            <QrSvg
              qr={qr}
              className="results-qr"
              label="QR code that opens this ranking"
              style={{ width: `max(160px, ${(qr.size + 8) * 2}px)` }}
            />
          )}
          <div className="results-foot-text">
            {qr && <strong>Scan to see this ranking and sort it yourself</strong>}
            <span>Made with Sort Anything</span>
          </div>
        </div>
      </div>

      {actions && <div className="results-next">{actions}</div>}
      {showQr && qr && (
        <QrDialog qr={qr} link={shareLink} title={title} onClose={() => setShowQr(false)} />
      )}
    </div>
  );
};

const QrDialog = ({
  qr,
  link,
  title,
  onClose
}: {
  qr: Qr;
  link: string;
  title: string;
  onClose: () => void;
}) => {
  const toast = useToast();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = () => {
    const scale = 12;
    const side = (qr.size + 8) * scale;
    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, side, side);
    context.fillStyle = '#12152a';
    context.translate(4 * scale, 4 * scale);
    context.scale(scale, scale);
    context.fill(new Path2D(qr.path));
    canvas.toBlob((blob) => {
      if (blob) download(blob, `${slug(title)}-qr.png`);
    });
  };

  return (
    <div
      className="qr-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="QR code"
      onClick={onClose}
    >
      <div className="qr-panel" onClick={(event) => event.stopPropagation()}>
        <QrSvg
          qr={qr}
          className="qr-big"
          label="QR code that opens this ranking"
          style={{ width: `${(qr.size + 8) * Math.max(2, Math.floor(412 / (qr.size + 8)))}px` }}
        />
        <p className="qr-caption">Scan to open this ranking on another device.</p>
        <div className="row wrap qr-actions">
          <button className="primary small" onClick={save}>
            Save QR image
          </button>
          <button
            className="small"
            onClick={() =>
              void navigator.clipboard.writeText(link).then(
                () => toast('Link copied'),
                () => toast('Copy was blocked by the browser.')
              )
            }
          >
            Copy link
          </button>
          <button className="ghost small" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const RankItem = ({
  item,
  tied,
  placeholder,
  adjusting,
  onTieWithAbove
}: {
  item: Item;
  tied: boolean;
  placeholder: boolean;
  adjusting: boolean;
  onTieWithAbove?: () => void;
}) => {
  const { setNodeRef, style, isDragging, handle } = useSortableRow(item.id);
  return (
    <div ref={setNodeRef} style={style} className={`rank-item${isDragging ? ' dragging' : ''}`}>
      {adjusting && <DragHandle label={`Move ${item.label}`} handle={handle} />}
      {item.image || item.media ? (
        <MediaThumb item={item} />
      ) : (
        placeholder && <span className="media-thumb thumb-placeholder" />
      )}
      <span className="rank-label">{item.label}</span>
      {tied && <span className="tag tie-tag">tie</span>}
      {adjusting && onTieWithAbove && (
        <span className="adjust" data-no-capture>
          <button className="ghost small" onClick={onTieWithAbove}>
            Tie with above
          </button>
        </span>
      )}
    </div>
  );
};
