import { useMemo } from 'react';
import { navigate } from '~/lib/hooks';
import { decodeShared } from '~/lib/share';
import { startSession } from '~/lib/session';
import { saveSession, writeJson } from '~/lib/storage';
import type { Item } from '~/lib/types';
import { ResultsView } from '~/components/ResultsView';
import { NotFound } from '~/components/NotFound';
import { DRAFT_KEY, draftFromItems } from '~/lib/draft';

export const SharedResultsPage = ({ route, data }: { route: string; data: string }) => {
  const list = useMemo(() => decodeShared(route, data), [route, data]);

  if (!list) return <NotFound what="shared ranking" />;

  const items: Item[] = list.items.map((item, i) => ({ ...item, id: String(i) }));
  const groups = (list.ranking ?? items.map((_, i) => [i])).map((g) => g.map(String));

  const sortYourself = () => {
    const session = startSession({
      title: list.title,
      items: list.items,
      mode: 'fresh',
      shuffle: true
    });
    saveSession(session);
    navigate(`/s/${session.id}`);
  };

  const openInEditor = () => {
    writeJson(DRAFT_KEY, draftFromItems(list.title, items, groups));
    navigate('/');
  };

  return (
    <>
      <div className="shared-banner">
        <p>Someone shared their ranking with you.</p>
        <button className="primary" onClick={sortYourself}>
          Sort this list yourself
        </button>
      </div>
      <ResultsView
        title={list.title}
        items={items}
        groups={groups}
        subtitle={<>{items.length} items</>}
        actions={
          <button className="ghost small" onClick={openInEditor}>
            Edit or add items
          </button>
        }
      />
    </>
  );
};
