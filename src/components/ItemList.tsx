import { useState } from 'react';
import type { DraftItem } from '~/lib/draft';
import { mediaLabel, parseMedia, searchUrl } from '~/lib/media';
import { useToast } from './Toast';
import { MediaThumb } from './MediaPlayer';

const SongEditor = ({
  item,
  onSave,
  onClose
}: {
  item: DraftItem;
  onSave: (media: string | undefined) => void;
  onClose: () => void;
}) => {
  const toast = useToast();
  const [value, setValue] = useState(item.media ?? '');
  const save = (raw: string) => {
    const url = raw.trim();
    if (url && !parseMedia(url)) {
      toast('Use a YouTube, Spotify or audio file link');
      return;
    }
    onSave(url || undefined);
  };
  return (
    <form
      className="song-editor"
      onSubmit={(event) => {
        event.preventDefault();
        save(value);
      }}
    >
      <input
        type="text"
        autoFocus
        value={value}
        placeholder="Paste a YouTube, Spotify or audio link"
        aria-label={`Song link for ${item.label}`}
        onChange={(event) => setValue(event.target.value)}
        onPaste={(event) => {
          const pasted = event.clipboardData.getData('text').trim();
          if (parseMedia(pasted)) {
            event.preventDefault();
            save(pasted);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
      />
      <a className="button small" href={searchUrl(item.label)} target="_blank" rel="noreferrer">
        Find on YouTube
      </a>
      <button className="small primary" type="submit">
        Save
      </button>
      {item.media && (
        <button className="small ghost" type="button" onClick={() => onSave(undefined)}>
          Remove song
        </button>
      )}
      <button className="small ghost" type="button" onClick={onClose}>
        Cancel
      </button>
    </form>
  );
};

export const ItemList = ({
  items,
  showRanks,
  editingSong,
  onEditSong,
  onChange,
  onRemove
}: {
  items: DraftItem[];
  showRanks: boolean;
  editingSong?: string;
  onEditSong: (key: string | undefined) => void;
  onChange: (items: DraftItem[]) => void;
  onRemove: (index: number) => void;
}) => {
  const [dragFrom, setDragFrom] = useState<number>();
  const [dragOver, setDragOver] = useState<number>();

  const update = (index: number, patch: Partial<DraftItem>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const saveSong = (index: number, media: string | undefined) => {
    update(index, { media });
    const next = items.findIndex((item, i) => i > index && !item.media);
    onEditSong(media && next !== -1 ? items[next].key : undefined);
  };

  return (
    <ol className="item-list">
      {items.map((item, index) => {
        const media = parseMedia(item.media);
        const asItem = { ...item, id: item.key };
        return (
          <li
            key={item.key}
            className={`item-row${dragFrom === index ? ' dragging' : ''}${dragOver === index && dragFrom !== index ? ' drop-target' : ''}`}
            onDragOver={(event) => {
              if (dragFrom === undefined) return;
              event.preventDefault();
              setDragOver(index);
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (dragFrom !== undefined) move(dragFrom, index);
              setDragFrom(undefined);
              setDragOver(undefined);
            }}
          >
            <div className="item-main">
              <span
                className="drag-handle"
                draggable
                title="Drag to reorder"
                aria-hidden="true"
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', item.label);
                  setDragFrom(index);
                }}
                onDragEnd={() => {
                  setDragFrom(undefined);
                  setDragOver(undefined);
                }}
              >
                <svg viewBox="0 0 24 24">
                  <circle cx="9" cy="6" r="1.6" />
                  <circle cx="15" cy="6" r="1.6" />
                  <circle cx="9" cy="12" r="1.6" />
                  <circle cx="15" cy="12" r="1.6" />
                  <circle cx="9" cy="18" r="1.6" />
                  <circle cx="15" cy="18" r="1.6" />
                </svg>
              </span>
              {showRanks && (
                <span className={`item-rank${item.rank === undefined ? ' is-new' : ''}`}>
                  {item.rank ?? 'new'}
                </span>
              )}
              {item.media || item.image ? (
                <MediaThumb item={asItem} />
              ) : (
                <button
                  className="media-thumb add-thumb"
                  onClick={() => onEditSong(item.key)}
                  aria-label={`Add a song to ${item.label}`}
                  title="Add a song"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12 6v12M6 12h12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              )}
              <input
                className="item-label"
                value={item.label}
                aria-label={`Item ${index + 1}`}
                onChange={(event) => update(index, { label: event.target.value })}
                onBlur={(event) => {
                  if (!event.target.value.trim()) onRemove(index);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
              />
              <button
                className={`song-chip${media ? ` has-song kind-${media.kind}` : ''}`}
                aria-expanded={editingSong === item.key}
                onClick={() => onEditSong(editingSong === item.key ? undefined : item.key)}
              >
                {media ? mediaLabel(media) : 'Add song'}
              </button>
              <button
                className="icon-button"
                aria-label={`Remove ${item.label}`}
                title="Remove"
                onClick={() => onRemove(index)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            {editingSong === item.key && (
              <SongEditor
                item={item}
                onSave={(value) => saveSong(index, value)}
                onClose={() => onEditSong(undefined)}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
};
