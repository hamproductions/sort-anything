import { describe, expect, it } from 'vitest';
import { buildMemory, restoreMedia } from './memory';
import { startSession } from './session';

describe('song memory', () => {
  const older = startSession({
    title: 'Old',
    items: [{ label: 'スターチス', media: 'https://youtu.be/old' }],
    mode: 'fresh',
    shuffle: false
  });
  const newer = startSession({
    title: '',
    items: [
      { label: 'スターチス', media: 'https://open.spotify.com/track/new' },
      { label: 'Dandelion', image: 'https://x.com/d.png' },
      { label: 'Plain' }
    ],
    mode: 'fresh',
    shuffle: false
  });
  const memory = buildMemory([newer, older]);

  it('re-attaches songs and pictures by name, newest first', () => {
    const { items, restored } = restoreMedia(
      [{ label: 'スターチス' }, { label: 'dandelion' }, { label: 'Plain' }, { label: 'Unknown' }],
      memory
    );
    expect(restored).toBe(2);
    expect(items).toEqual([
      { label: 'スターチス', media: 'https://open.spotify.com/track/new' },
      { label: 'dandelion', image: 'https://x.com/d.png' },
      { label: 'Plain' },
      { label: 'Unknown' }
    ]);
  });

  it('keeps links that were pasted explicitly', () => {
    const { items, restored } = restoreMedia(
      [{ label: 'スターチス', media: 'https://youtu.be/pasted' }],
      memory
    );
    expect(restored).toBe(0);
    expect(items[0].media).toBe('https://youtu.be/pasted');
  });

  it('leaves an empty title empty', () => {
    expect(newer.title).toBe('');
  });
});
