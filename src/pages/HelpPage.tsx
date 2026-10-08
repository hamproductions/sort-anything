import { useDocumentTitle } from '~/lib/hooks';

export const HelpPage = () => {
  useDocumentTitle('How to use');
  return (
    <article className="help">
      <h1>How to use Sort Anything</h1>
      <p className="help-lede">
        Paste a list, pick your favorite of each pair, and get a full ranking. Everything stays in
        your browser, and sharing works through links.
      </p>

      <nav className="help-toc" aria-label="On this page">
        <a href="#/help" onClick={(e) => jump(e, 'start')}>
          Start a ranking
        </a>
        <a href="#/help" onClick={(e) => jump(e, 'discord')}>
          Copy a list from Discord
        </a>
        <a href="#/help" onClick={(e) => jump(e, 'songs')}>
          Add songs
        </a>
        <a href="#/help" onClick={(e) => jump(e, 'sorting')}>
          Sorting
        </a>
        <a href="#/help" onClick={(e) => jump(e, 'results')}>
          Share your results
        </a>
        <a href="#/help" onClick={(e) => jump(e, 'again')}>
          Rank again or add more
        </a>
      </nav>

      <section id="start">
        <h2>Start a ranking</h2>
        <ol>
          <li>Paste anything into the box at the top of the list and press Enter.</li>
          <li>Fix names by clicking them, drag rows to reorder, and remove what you don’t want.</li>
          <li>
            Press <strong>Start sorting</strong> (or <kbd>Ctrl</kbd>+<kbd>Enter</kbd>).
          </li>
        </ol>
        <p>The box understands:</p>
        <ul>
          <li>One item per line, or one line separated by commas.</li>
          <li>
            Numbered rankings like <code>1. Name</code>, <code>#2 Name</code> or{' '}
            <code>**3.** Name</code>. Equal numbers are ties.
          </li>
          <li>
            <code>Name | link</code> to attach a picture or a song.
          </li>
          <li>A YouTube playlist link, which adds every video in it.</li>
          <li>Rows copied from a spreadsheet, and Sort Anything links.</li>
          <li>A text file dropped anywhere on the page.</li>
        </ul>
      </section>

      <section id="discord">
        <h2>Copy a list from Discord</h2>
        <p>On a computer:</p>
        <ol>
          <li>Hover the message with the list and click the three dots on the right.</li>
          <li>
            Choose <strong>Copy Text</strong>. You can also right-click the message for the same
            option.
          </li>
          <li>Paste it into the box here. Numbering, bold, links and ties are kept.</li>
        </ol>
        <p>On a phone:</p>
        <ol>
          <li>Press and hold the message.</li>
          <li>
            Tap <strong>Copy Text</strong>, then paste into the box.
          </li>
        </ol>
        <p>
          If the list is spread over several messages, select across them with the mouse and copy
          with <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>C</kbd>. Name and time lines are skipped; anything
          else that slips in can be removed with the × on its row.
        </p>
        <p>
          Selecting text in Discord copies only the visible names, not the song links. If you have
          sorted those songs before on this device, their songs and pictures are added back
          automatically.
        </p>
        <p>
          Posting your result back to Discord works the other way: press <strong>Copy list</strong>{' '}
          on the results page and paste it into the chat. Links are wrapped so Discord doesn’t turn
          them into big previews, and anyone can paste that message straight into their own sort.
        </p>
      </section>

      <section id="songs">
        <h2>Add songs</h2>
        <ul>
          <li>
            Click the <strong>+</strong> on a row, then <strong>Find on YouTube</strong> to search
            for it. Copy the video’s address, paste it in, and the next row opens for you.
          </li>
          <li>
            YouTube, Spotify and direct audio file links all work. Add <code>?t=60</code> to a
            YouTube link to start a minute in.
          </li>
          <li>Paste a link on its own and its title is filled in for you.</li>
          <li>
            Spotify playlists can’t be read from a link. In the Spotify app, open the playlist,
            select all tracks (<kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>A</kbd>), copy, and paste here.
          </li>
          <li>Click a picture to play the song right there.</li>
        </ul>
      </section>

      <section id="sorting">
        <h2>Sorting</h2>
        <ul>
          <li>
            Click the side you prefer, or press <kbd>←</kbd> / <kbd>→</kbd>.
          </li>
          <li>
            <kbd>↓</kbd> marks a tie, <kbd>↑</kbd> undoes the last pick.
          </li>
          <li>
            <kbd>Q</kbd> and <kbd>E</kbd> play the left and right song inside its card.
          </li>
          <li>
            <strong>Remove</strong> drops an item you don’t know. Undo brings it back.
          </li>
          <li>
            Progress saves on this device. Leave any time and continue from{' '}
            <strong>My rankings</strong>.
          </li>
        </ul>
      </section>

      <section id="results">
        <h2>Share your results</h2>
        <ul>
          <li>
            <strong>Copy list</strong> copies a numbered list with song links that pastes into chats
            and back into a new sort.
          </li>
          <li>
            <strong>Play recap</strong> plays a story of your top five with their songs. Tap to
            skip, hold to pause, and save any slide as a picture.
          </li>
          <li>
            <strong>Save image</strong> downloads the ranking as a picture with a QR code at the
            bottom. Scanning it opens your exact ranking, songs included.
          </li>
          <li>
            <strong>QR code</strong> shows the code large, for scanning from another screen or
            saving on its own. The recap’s last slide carries it too.
          </li>
          <li>
            Under <strong>More</strong>: a share link that opens your exact ranking, a link that
            gives friends the same list to sort, names only, and a CSV file.
          </li>
        </ul>
      </section>

      <section id="again">
        <h2>Rank again or add more</h2>
        <ul>
          <li>
            Paste a finished ranking with new lines under it. Choose <strong>Place the new</strong>{' '}
            and you only rank the new items against your list.
          </li>
          <li>
            <strong>Sort again from scratch</strong> re-ranks everything.{' '}
            <strong>Adjust order</strong> lets you move items by hand.
          </li>
        </ul>
      </section>

      <a className="button primary" href="#/">
        Start a ranking
      </a>
    </article>
  );
};

const jump = (event: { preventDefault: () => void }, id: string) => {
  event.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
