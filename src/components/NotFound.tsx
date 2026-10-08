export const NotFound = ({ what }: { what: string }) => (
  <div className="empty-state">
    <h1>Can’t find that {what}</h1>
    <p className="muted">
      Rankings in progress live in this browser only. If you started it on another device, open it
      there, or share it as a link once it’s finished.
    </p>
    <a className="button primary" href="#/">
      Start a new ranking
    </a>
  </div>
);
