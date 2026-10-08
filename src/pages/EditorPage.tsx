import { useEffect, useRef, useState } from 'react';
import type { ClipboardEvent, DragEvent } from 'react';
import { navigate, useDocumentTitle, usePersistentState } from '~/lib/hooks';
import { parseInput } from '~/lib/parse';
import { decodeList } from '~/lib/share';
import { calculateMaxComparisons } from '~/lib/merge-sort';
import { startSession } from '~/lib/session';
import { saveSession, writeJson } from '~/lib/storage';
import { fetchMediaInfo, youtubePlaylistId } from '~/lib/media';
import { importYouTubePlaylist } from '~/lib/youtube-playlist';
import {
  DRAFT_KEY,
  EMPTY_DRAFT,
  draftFromItems,
  draftFromText,
  draftItemsFrom,
  draftRanking,
  draftToText,
  loadDraft,
  mergeItems,
  newKey
} from '~/lib/draft';
import type { Draft, DraftItem } from '~/lib/draft';
import { useToast } from '~/components/Toast';
import { ItemList } from '~/components/ItemList';

const EXAMPLES = [
  {
    title: 'Pizza toppings',
    text: 'Pepperoni\nMushroom\nPineapple\nOlives\nBasil\nSausage\nAnchovies\nJalapeño\nOnion\nExtra cheese'
  },
  {
    title: 'Studio Ghibli films',
    text: "Spirited Away\nMy Neighbor Totoro\nPrincess Mononoke\nHowl's Moving Castle\nKiki's Delivery Service\nCastle in the Sky\nPorco Rosso\nThe Wind Rises\nPonyo\nThe Boy and the Heron"
  },
  { title: 'Planets', text: 'Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune' }
];

const insertEstimate = (ranked: number, pending: number) =>
  Array.from({ length: pending }, (_, i) => Math.ceil(Math.log2(ranked + i + 1))).reduce(
    (a, b) => a + b,
    0
  );

const looksLikeList = (text: string) =>
  /\n/.test(text.trim()) || /https?:\/\/|spotify:/.test(text) || /[,;、]/.test(text);

export const EditorPage = ({ listData }: { listData?: string }) => {
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(loadDraft);
  const [pasteText, setPasteText] = useState('');
  const [mode, setMode] = useState<'insert' | 'fresh'>('insert');
  const [shuffle, setShuffle] = usePersistentState('sa:shuffle', true);
  const [editingSong, setEditingSong] = useState<string>();
  const [textMode, setTextMode] = useState<string>();
  const [importing, setImporting] = useState<string[]>([]);
  const [spotifyHint, setSpotifyHint] = useState(false);
  const [dragging, setDragging] = useState(false);
  const resolved = useRef(new Set<string>());
  useDocumentTitle(draft.title);
  const loadedLink = useRef<string>(undefined);

  useEffect(() => {
    writeJson(DRAFT_KEY, draft);
  }, [draft]);

  useEffect(() => {
    if (!listData || loadedLink.current === listData) return;
    loadedLink.current = listData;
    const list = decodeList(listData);
    if (list) {
      setDraft(
        draftFromItems(
          list.title,
          list.items.map((item, i) => ({ ...item, id: String(i) }))
        )
      );
      toast(`Loaded ${list.items.length} items from the link`);
    } else {
      toast('That link is broken or incomplete');
    }
    history.replaceState(null, '', '#/');
    dispatchEvent(new HashChangeEvent('hashchange'));
  }, [listData, toast]);

  useEffect(() => {
    const pending = draft.items.filter(
      (item) => item.media && item.label === item.media && !resolved.current.has(item.key)
    );
    for (const item of pending) {
      resolved.current.add(item.key);
      void fetchMediaInfo(item.media!).then((info) => {
        if (!info?.title) return;
        setDraft((d) => ({
          ...d,
          items: d.items.map((x) =>
            x.key === item.key && x.label === x.media ? { ...x, label: info.title! } : x
          )
        }));
      });
    }
  }, [draft.items]);

  const setItems = (items: DraftItem[]) => setDraft((d) => ({ ...d, items }));

  const importPlaylist = (url: string) => {
    const listId = youtubePlaylistId(url);
    if (!listId) return;
    setImporting((list) => [...list, url]);
    importYouTubePlaylist(listId)
      .then(({ title, videos }) => {
        const incoming = videos.map((video) => ({
          key: newKey(),
          label: video.title!,
          media: video.url
        }));
        setDraft((d) => ({
          ...d,
          title: d.title || title || '',
          items: mergeItems(d.items, incoming).items
        }));
        toast(`Added ${videos.length} videos${title ? ` from ${title}` : ''}`);
      })
      .catch((error: Error) => toast(error.message))
      .finally(() => setImporting((list) => list.filter((x) => x !== url)));
  };

  const addText = (text: string) => {
    if (!text.trim()) return;
    const parsed = parseInput(text);
    parsed.playlists.forEach(importPlaylist);
    if (parsed.spotifyCollections.length > 0) setSpotifyHint(true);
    const { items, added, merged } = mergeItems(draft.items, draftItemsFrom(parsed));
    setDraft((d) => ({ ...d, title: d.title || parsed.title || '', items }));
    setPasteText('');
    if (added || merged) {
      toast(
        [
          added && `Added ${added} ${added === 1 ? 'item' : 'items'}`,
          merged && `${merged} already in the list`
        ]
          .filter(Boolean)
          .join(', ')
      );
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const text = event.clipboardData.getData('text');
    if (!looksLikeList(text) || pasteText.trim()) return;
    event.preventDefault();
    addText(text);
  };

  const readFile = async (file: File) => {
    const text = await file.text();
    setDraft((d) => ({ ...d, title: d.title || file.name.replace(/\.[a-z0-9]+$/i, '') }));
    addText(text);
  };

  const onDropFile = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void readFile(file);
  };

  const remove = (index: number) => {
    const before = draft.items;
    const removed = before[index];
    setItems(before.filter((_, i) => i !== index));
    toast(`Removed ${removed.label}`, { label: 'Undo', run: () => setItems(before) });
  };

  const clearAll = () => {
    const before = draft;
    setDraft(EMPTY_DRAFT);
    toast('List cleared', { label: 'Undo', run: () => setDraft(before) });
  };

  const items = draft.items;
  const hasRanking = items.some((item) => item.rank !== undefined);
  const newCount = items.filter((item) => item.rank === undefined).length;
  const canInsert = hasRanking && newCount > 0 && newCount < items.length;
  const effectiveMode = canInsert ? mode : 'fresh';
  const estimate =
    effectiveMode === 'insert'
      ? insertEstimate(items.length - newCount, newCount)
      : calculateMaxComparisons(items.length);
  const canStart = items.length >= 2;
  const songCount = items.filter((item) => item.media).length;

  const start = () => {
    if (!canStart) return;
    const session = startSession({
      title: draft.title,
      items: items.map(({ label, image, media }) => ({ label, image, media })),
      ranking: draftRanking(items),
      unranked: items.map((item, i) => (item.rank === undefined ? i : -1)).filter((i) => i >= 0),
      mode: effectiveMode,
      shuffle
    });
    saveSession(session);
    navigate(session.finishedAt ? `/done/${session.id}` : `/s/${session.id}`);
  };

  return (
    <div
      className={`workspace${dragging ? ' is-dropping' : ''}`}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false);
      }}
      onDrop={onDropFile}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) start();
      }}
    >
      <h1 className="sr-only">Rank any list by picking between two</h1>
      <div className="workspace-bar">
        <input
          className="title-input"
          value={draft.title}
          placeholder="Name this ranking"
          aria-label="Ranking name"
          maxLength={120}
          onChange={(event) => setDraft((d) => ({ ...d, title: event.target.value }))}
        />
        <div className="bar-meta">
          <span>
            <strong>{items.length}</strong> {items.length === 1 ? 'item' : 'items'}
          </span>
          {canStart && (
            <span className="muted">
              {effectiveMode === 'insert' ? `about ${estimate}` : `up to ${estimate}`} picks
            </span>
          )}
        </div>
        <button className="primary start-button" disabled={!canStart} onClick={start}>
          Start sorting
        </button>
      </div>

      <div className="paste-box">
        <textarea
          value={pasteText}
          rows={pasteText.includes('\n') ? Math.min(8, pasteText.split('\n').length + 1) : 1}
          placeholder={
            items.length === 0
              ? 'Paste a list, a ranking or song links'
              : 'Add more: type and press Enter, or paste'
          }
          aria-label="Add items"
          spellCheck={false}
          onChange={(event) => setPasteText(event.target.value)}
          onPaste={onPaste}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
              event.preventDefault();
              addText(pasteText);
            }
          }}
        />
        <button className="small" disabled={!pasteText.trim()} onClick={() => addText(pasteText)}>
          Add
        </button>
        <label className="button small ghost file-button">
          Import file
          <input
            type="file"
            accept=".txt,.csv,.tsv,.md,text/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void readFile(file);
              event.target.value = '';
            }}
          />
        </label>
      </div>

      {spotifyHint && (
        <div className="note" role="status">
          <span>
            Spotify playlists and albums can’t be read from a link without a server. Open it in the
            Spotify app, select all tracks (<kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>A</kbd>), copy, and
            paste here.
          </span>
          <button className="small ghost" onClick={() => setSpotifyHint(false)}>
            Got it
          </button>
        </div>
      )}

      {importing.length > 0 && (
        <p className="importing" role="status">
          Importing{' '}
          {importing.length === 1 ? 'a YouTube playlist' : `${importing.length} playlists`}…
        </p>
      )}

      {items.length > 0 && textMode === undefined && (
        <div className="list-toolbar">
          <span className="muted">
            {songCount > 0 && `${songCount} with songs. `}
            {hasRanking && newCount > 0 && `${newCount} new to place.`}
          </span>
          <div className="row">
            <button className="small ghost" onClick={() => setTextMode(draftToText(items))}>
              Edit as text
            </button>
            <button className="small ghost" onClick={clearAll}>
              Clear list
            </button>
          </div>
        </div>
      )}

      {textMode !== undefined ? (
        <div className="text-mode">
          <textarea
            value={textMode}
            autoFocus
            spellCheck={false}
            aria-label="List as text"
            onChange={(event) => setTextMode(event.target.value)}
          />
          <div className="row wrap">
            <button
              className="primary small"
              onClick={() => {
                setDraft((d) => draftFromText(d.title, textMode));
                setTextMode(undefined);
              }}
            >
              Apply changes
            </button>
            <button className="ghost small" onClick={() => setTextMode(undefined)}>
              Cancel
            </button>
            <span className="muted small-text">
              One per line. <code>Name | link</code> adds a song or picture. Numbers like{' '}
              <code>1.</code> keep a ranking.
            </span>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-list">
          <p className="empty-title">Nothing to sort yet</p>
          <p className="muted">
            Paste a list above. Numbered rankings, YouTube playlists, Spotify track links,{' '}
            <code>Name | image or song link</code>, spreadsheet rows and shared Sort Anything links
            all work. You can also drop a text file anywhere on the page.{' '}
            <a href="#/help">How to use, including copying a list from Discord</a>.
          </p>
          <div className="row wrap">
            <span className="muted">Try one:</span>
            {EXAMPLES.map((example) => (
              <button
                key={example.title}
                className="small"
                onClick={() => setDraft(draftFromText(example.title, example.text))}
              >
                {example.title}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ItemList
          items={items}
          showRanks={hasRanking}
          editingSong={editingSong}
          onEditSong={setEditingSong}
          onChange={setItems}
          onRemove={remove}
        />
      )}

      {items.length > 0 && textMode === undefined && (
        <div className="start-options">
          {canInsert && (
            <div className="segmented" role="group" aria-label="How to sort">
              <button aria-pressed={effectiveMode === 'insert'} onClick={() => setMode('insert')}>
                Place the {newCount} new
              </button>
              <button aria-pressed={effectiveMode === 'fresh'} onClick={() => setMode('fresh')}>
                Re-sort everything
              </button>
            </div>
          )}
          <label className="toggle">
            <input
              type="checkbox"
              checked={shuffle}
              onChange={(event) => setShuffle(event.target.checked)}
            />
            Shuffle the order
          </label>
          <span className="muted small-text">
            <kbd>Ctrl</kbd>+<kbd>Enter</kbd> starts
          </span>
        </div>
      )}
    </div>
  );
};
