import { useHashRoute, useTheme } from './lib/hooks';
import { ToastProvider } from './components/Toast';
import { PlayerProvider } from './components/MediaPlayer';
import { RankingsMenu } from './components/RankingsMenu';
import { EditorPage } from './pages/EditorPage';
import { SorterPage } from './pages/SorterPage';
import { SessionResultsPage } from './pages/SessionResultsPage';
import { SharedResultsPage } from './pages/SharedResultsPage';
import { HelpPage } from './pages/HelpPage';

const THEME_LABEL = { system: 'Auto', light: 'Light', dark: 'Dark' };

export const App = () => {
  const { name, param } = useHashRoute();
  const { theme, cycle } = useTheme();

  const page =
    name === 's' && param ? (
      <SorterPage key={param} id={param} />
    ) : name === 'done' && param ? (
      <SessionResultsPage key={param} id={param} />
    ) : name === 'r' && param ? (
      <SharedResultsPage key={param} data={param} />
    ) : name === 'help' ? (
      <HelpPage />
    ) : (
      <EditorPage listData={name === 'l' ? param : undefined} />
    );

  return (
    <ToastProvider>
      <PlayerProvider>
        <div className="shell">
          <header className="topbar">
            <a className="wordmark" href="#/" aria-label="Sort Anything home">
              <span className="wordmark-a">Sort</span>
              <span className="wordmark-b">Anything</span>
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
        </div>
      </PlayerProvider>
    </ToastProvider>
  );
};
