import { useState } from 'react';
import type { DraftItem } from '~/lib/draft';
import { mediaLabel, parseMedia, searchUrl } from '~/lib/media';
import { useToast } from './Toast';
import { MediaThumb } from './MediaPlayer';
import { arrayMove } from '@dnd-kit/sortable';
import { DragHandle, SortableList, useSortableRow } from './Sortable';

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

type RowProps = {
  item: DraftItem;
  index: number;
  showRanks: boolean;
  editing: boolean;
  onEditSong: (key: string | undefined) => void;
  onUpdate: (patch: Partial<DraftItem>) => void;
  onSaveSong: (media: string | undefined) => void;
  onRemove: () => void;
};

const ItemRow = ({
  item,
  index,
  showRanks,
  editing,
  onEditSong,
  onUpdate,
  onSaveSong,
  onRemove
}: RowProps) => {
  const { setNodeRef, style, isDragging, handle } = useSortableRow(item.key);
  const media = parseMedia(item.media);
  const asItem = { ...item, id: item.key };
  return (
    <li ref={setNodeRef} style={style} className={`item-row${isDragging ? ' dragging' : ''}`}>
      <div className="item-main">
        <DragHandle label={`Move ${item.label}`} handle={handle} />
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
          onChange={(event) => onUpdate({ label: event.target.value })}
          onBlur={(event) => {
            if (!event.target.value.trim()) onRemove();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
        <button
          className={`song-chip${media ? ` has-song kind-${media.kind}` : ''}`}
          aria-expanded={editing}
          onClick={() => onEditSong(editing ? undefined : item.key)}
        >
          {media ? mediaLabel(media) : 'Add song'}
        </button>
        <button
          className="icon-button"
          aria-label={`Remove ${item.label}`}
          title="Remove"
          onClick={onRemove}
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
      {editing && (
        <SongEditor item={item} onSave={onSaveSong} onClose={() => onEditSong(undefined)} />
      )}
    </li>
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
  const update = (index: number, patch: Partial<DraftItem>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const saveSong = (index: number, media: string | undefined) => {
    update(index, { media });
    const next = items.findIndex((item, i) => i > index && !item.media);
    onEditSong(media && next !== -1 ? items[next].key : undefined);
  };

  return (
    <SortableList
      ids={items.map((item) => item.key)}
      onMove={(from, to) => onChange(arrayMove(items, from, to))}
    >
      <ol className="item-list">
        {items.map((item, index) => (
          <ItemRow
            key={item.key}
            item={item}
            index={index}
            showRanks={showRanks}
            editing={editingSong === item.key}
            onEditSong={onEditSong}
            onUpdate={(patch) => update(index, patch)}
            onSaveSong={(media) => saveSong(index, media)}
            onRemove={() => onRemove(index)}
          />
        ))}
      </ol>
    </SortableList>
  );
};
