import { useEffect, useRef, useState } from 'react';
import { getProgress } from '~/lib/engine';
import { formatRelative } from '~/lib/format';
import { deleteSession, listSessions } from '~/lib/storage';
import type { Session } from '~/lib/types';

export const RankingsMenu = ({ route }: { route: string }) => {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<Session[]>(() => listSessions());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
    setSessions(listSessions());
  }, [route]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === 'Escape'
          : !ref.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
    };
  }, [open]);

  const inProgress = sessions.filter((s) => !s.finishedAt).length;

  return (
    <div className="menu" ref={ref}>
      <button
        className="ghost small menu-trigger"
        aria-expanded={open}
        onClick={() => {
          setSessions(listSessions());
          setOpen((o) => !o);
        }}
      >
        My rankings
        {sessions.length > 0 && <span className="count">{sessions.length}</span>}
        {inProgress > 0 && <span className="dot" title={`${inProgress} in progress`} />}
      </button>
      {open && (
        <div className="menu-panel" role="menu">
          {sessions.length === 0 ? (
            <p className="muted menu-empty">Rankings you start are saved here on this device.</p>
          ) : (
            <ul>
              {sessions.map((session) => {
                const progress = getProgress(session.engine, session.comparisons);
                return (
                  <li key={session.id}>
                    <a
                      role="menuitem"
                      href={session.finishedAt ? `#/done/${session.id}` : `#/s/${session.id}`}
                    >
                      <span className="menu-title">{session.title}</span>
                      <span className="muted menu-meta">
                        {session.finishedAt ? 'Finished' : `${Math.round(progress * 100)}% sorted`},{' '}
                        {session.items.length} items, {formatRelative(session.updatedAt)}
                      </span>
                      {!session.finishedAt && (
                        <span className="menu-progress">
                          <span style={{ width: `${progress * 100}%` }} />
                        </span>
                      )}
                    </a>
                    <button
                      className="icon-button"
                      aria-label={`Delete ${session.title}`}
                      title="Delete"
                      onClick={() => {
                        deleteSession(session.id);
                        setSessions(listSessions());
                      }}
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
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
