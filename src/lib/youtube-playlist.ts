import { cleanTitle, fetchMediaInfo } from './media';
import { loadYouTubeApi } from './youtube-api';
import type { YTPlayer } from './youtube-api';

const readVideoIds = async (listId: string) => {
  const YT = await loadYouTubeApi();
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:200px;height:200px;';
  const target = document.createElement('div');
  host.appendChild(target);
  document.body.appendChild(host);

  return new Promise<string[]>((resolve, reject) => {
    let player: YTPlayer | undefined;
    const finish = (result: string[] | Error) => {
      window.clearTimeout(timeout);
      player?.destroy();
      host.remove();
      if (result instanceof Error) reject(result);
      else resolve(result);
    };
    const timeout = window.setTimeout(
      () => finish(new Error('Timed out reading the playlist')),
      15000
    );
    player = new YT.Player(target, {
      width: 200,
      height: 200,
      playerVars: { listType: 'playlist', list: listId, autoplay: 0, mute: 1 },
      events: {
        onReady: () => {
          let attempts = 0;
          const poll = () => {
            const ids = player?.getPlaylist();
            if (ids && ids.length > 0) return finish([...new Set(ids)]);
            if (++attempts > 30) return finish(new Error('That playlist is empty or private'));
            window.setTimeout(poll, 200);
          };
          poll();
        },
        onError: () => finish(new Error('That playlist is private or unavailable'))
      }
    });
  });
};

const mapLimited = async <T, R>(list: T[], limit: number, fn: (item: T) => Promise<R>) => {
  const results: R[] = new Array(list.length);
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const index = next++;
      results[index] = await fn(list[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker));
  return results;
};

const fetchPlaylistTitle = async (listId: string) => {
  try {
    const url = `https://www.youtube.com/playlist?list=${listId}`;
    const response = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`
    );
    if (!response.ok) return undefined;
    const data = (await response.json()) as { title?: string };
    return data.title ? cleanTitle(data.title) : undefined;
  } catch {
    return undefined;
  }
};

export type PlaylistVideo = { url: string; title?: string };

export const importYouTubePlaylist = async (listId: string) => {
  const [ids, title] = await Promise.all([readVideoIds(listId), fetchPlaylistTitle(listId)]);
  const videos = await mapLimited(ids, 8, async (id): Promise<PlaylistVideo> => {
    const url = `https://youtu.be/${id}`;
    const info = await fetchMediaInfo(url);
    return { url, title: info?.title };
  });
  return { title, videos: videos.filter((video) => video.title) };
};
