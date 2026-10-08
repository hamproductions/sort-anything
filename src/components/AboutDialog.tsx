import { useEffect, useRef } from 'react';

export const REPO_URL = 'https://github.com/hamproductions/sort-anything';

export const AboutDialog = ({ onClose }: { onClose: () => void }) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="about-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="about-title">About Sort Anything</h2>
        <p>Rank any list by picking your favorite of each pair. Free, no account, open source.</p>

        <h3>Your data stays on this device</h3>
        <ul>
          <li>
            Lists, rankings in progress and settings are saved in this browser only. There is no
            server, account, tracking or analytics.
          </li>
          <li>
            Share links and QR codes carry the whole list inside the link itself, after the{' '}
            <code>#</code>, which browsers never send to the website. Only people you give it to can
            see it.
          </li>
          <li>Clearing this site’s data in your browser deletes everything.</li>
        </ul>

        <h3>What other sites see</h3>
        <ul>
          <li>
            YouTube and Spotify links: their titles and covers are looked up from YouTube or
            Spotify, and songs play through their players.
          </li>
          <li>Pictures load from wherever their links point.</li>
          <li>Fonts load from Google Fonts. The site is hosted on GitHub Pages.</li>
        </ul>

        <div className="row wrap about-actions">
          <a className="button primary small" href={REPO_URL} target="_blank" rel="noreferrer">
            <svg viewBox="0 0 16 16" aria-hidden="true" className="github-icon">
              <path
                fill="currentColor"
                d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
              />
            </svg>
            Source code on GitHub
          </a>
          <a className="button small" href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer">
            Report a problem
          </a>
          <button ref={closeRef} className="ghost small" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
