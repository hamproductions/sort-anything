import { useHashRoute, useTheme } from './lib/hooks';
import { ToastProvider } from './components/Toast';
import { PlayerProvider } from './components/MediaPlayer';
import { RankingsMenu } from './components/RankingsMenu';
import { EditorPage } from './pages/EditorPage';
import { SorterPage } from './pages/SorterPage';
import { SessionResultsPage } from './pages/SessionResultsPage';
import { SharedResultsPage } from './pages/SharedResultsPage';
import { HelpPage } from './pages/HelpPage';
import { AboutDialog } from './components/AboutDialog';
import { useState } from 'react';

const THEME_LABEL = { system: 'Auto', light: 'Light', dark: 'Dark' };

export const App = () => {
  const { name, param } = useHashRoute();
  const { theme, cycle } = useTheme();
  const [about, setAbout] = useState(false);

  const page =
    name === 's' && param ? (
      <SorterPage key={param} id={param} />
    ) : name === 'done' && param ? (
      <SessionResultsPage key={param} id={param} />
    ) : (name === 'r' || name === 'R') && param ? (
      <SharedResultsPage key={param} route={name} data={param} />
    ) : name === 'help' ? (
      <HelpPage />
    ) : (
      <EditorPage
        listLink={
          (name === 'l' || name === 'L') && param ? { route: name, data: param } : undefined
        }
      />
    );

  return (
    <ToastProvider>
      <PlayerProvider>
        <div className="shell">
          <header className="topbar">
            <a className="wordmark" href="#/" aria-label="Sort Anything home">
              <span className="wordmark-a">Sort</span> <span className="wordmark-b">Anything</span>
            </a>
            <nav className="topbar-actions">
              <a
                className="button ghost small"
                href="#/help"
                aria-current={name === 'help' ? 'page' : undefined}
              >
                <span className="wide-only">How to use</span>
                <span className="narrow-only">Help</span>
              </a>
              <RankingsMenu route={`${name}/${param}`} />
              <button
                className="ghost small about-button"
                onClick={() => setAbout(true)}
                aria-haspopup="dialog"
                aria-label="About"
              >
                <span className="wide-only">About</span>
                <svg className="narrow-only" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path
                    d="M12 11v6M12 7.5v.5"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <button
                className="icon-button theme-button"
                onClick={cycle}
                title={`Color theme: ${THEME_LABEL[theme]}. Click to change.`}
                aria-label={`Color theme: ${THEME_LABEL[theme]}`}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
                  {theme === 'system' && <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />}
                  {theme === 'dark' && <circle cx="12" cy="12" r="8" fill="currentColor" />}
                </svg>
              </button>
            </nav>
          </header>
          <main className="page">{page}</main>
          {about && <AboutDialog onClose={() => setAbout(false)} />}
        </div>
      </PlayerProvider>
    </ToastProvider>
  );
};
