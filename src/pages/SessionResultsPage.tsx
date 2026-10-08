import { useEffect, useState } from 'react';
import { navigate } from '~/lib/hooks';
import { formatDuration } from '~/lib/format';
import { applyUndo, restartSession, sessionPicks, sessionResult } from '~/lib/session';
import { loadSession, saveSession, writeJson } from '~/lib/storage';
import type { Session } from '~/lib/types';
import { ResultsView } from '~/components/ResultsView';
import { NotFound } from '~/components/NotFound';
import { DRAFT_KEY, draftFromItems } from '~/lib/draft';

export const SessionResultsPage = ({ id }: { id: string }) => {
  const [session, setSession] = useState<Session | undefined>(() => loadSession(id));

  useEffect(() => {
    if (session) saveSession(session);
  }, [session]);

  if (!session) return <NotFound what="ranking" />;

  const groups = sessionResult(session);
  const removed = session.items.length - groups.flat().length;
  const duration = (session.finishedAt ?? session.updatedAt) - session.createdAt;
  const picks = sessionPicks(session);

  const sortAgain = () => {
    const next = restartSession(session);
    saveSession(next);
    navigate(`/s/${next.id}`);
  };

  const addItems = () => {
    writeJson(DRAFT_KEY, draftFromItems(session.title, session.items, groups));
    navigate('/');
  };

  const backToSorting = () => {
    const previous = applyUndo(session);
    saveSession(previous);
    navigate(`/s/${previous.id}`);
  };

  return (
    <ResultsView
      stats={{
        picks: session.comparisons,
        durationMs: picks.length > 0 ? picks.reduce((sum, pick) => sum + pick.ms, 0) : duration,
        removed,
        log: picks
      }}
      title={session.title}
      items={session.items}
      groups={groups}
      subtitle={
        <>
          {groups.flat().length} items ranked in {session.comparisons} picks
          {duration > 1000 && <>, {formatDuration(duration)}</>}
          {removed > 0 && <>, {removed} removed</>}
          {session.override && <>, adjusted by hand</>}
        </>
      }
      onTitleChange={(title) => setSession((s) => s && { ...s, title, updatedAt: Date.now() })}
      onGroupsChange={(override) =>
        setSession((s) => s && { ...s, override, updatedAt: Date.now() })
      }
      actions={
        <>
          {session.history.length > 0 && (
            <button className="ghost small" onClick={backToSorting}>
              Undo last pick
            </button>
          )}
          <button className="ghost small" onClick={addItems}>
            Add more items
          </button>
          <button className="ghost small" onClick={sortAgain}>
            Sort again from scratch
          </button>
        </>
      }
    />
  );
};
