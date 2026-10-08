# Sort Anything

Rank any list by picking between two items at a time. Paste a list, answer the matchups, share the result as a link.

No backend: every shared result or list lives entirely in the URL, and sorts in progress are saved in the browser's localStorage.

**Use it:** https://hamproductions.github.io/sort-anything/ (the in-app guide is under "How to use").

## How to use

1. Paste a list into the box at the top and press Enter. One item per line, numbered rankings, `Name | link`, YouTube playlist links and spreadsheet rows all work.
2. Rename, reorder or remove items in the list, attach songs with the **+** on each row, then press **Start sorting**.
3. Pick the side you prefer (`←` / `→`), `↓` for a tie, `↑` to undo. `Q` / `E` play the left or right song.
4. On the results page, **Copy list** gives you a list you can post anywhere and paste straight into a new sort. **Play recap** plays a story of your top five with their songs.

### Copying a list from Discord

- Computer: hover the message, click the three dots (or right-click the message), choose **Copy Text**, and paste it into the box.
- Phone: press and hold the message, tap **Copy Text**, and paste.
- Lists posted with **Copy list** keep their ranks, ties and song links when pasted back. Links are wrapped in `<...>` so Discord does not expand them into previews.

## Features

- Pairwise sorting with ties, undo, and removing items mid-sort (merge sort adapted from [the-sorter](https://github.com/hamproductions/the-sorter)).
- Paste a previous ranking plus new lines and only the new items are placed (binary insertion), instead of re-sorting everything.
- Smart input: plain lines, comma/semicolon/slash separated lines, numbered rankings (`1.`, `#2`, `3)`, equal numbers are ties), bullets, `Name | image-url`, Markdown images and tables, spreadsheet rows, `# Heading` as title, dropped text files, and Sort Anything links or copied result text.
- Songs: attach YouTube, Spotify or direct audio links (`Name | link`, `Name | image | link`, or the + box per item with a YouTube search shortcut). Bare YouTube/Spotify links get their titles filled in via oEmbed. A YouTube playlist link imports every video (read through the YouTube IFrame player, no API key). Spotify playlists cannot be read without a server: copy all tracks in the Spotify app and paste. Songs play inside their own card, thumbnail or tile (`Q` / `E` in the sorter); YouTube `?t=` start times are respected.
- Results: list or image grid, hand adjustments, copy list (Markdown that pastes back into a new sort, links wrapped so chat apps do not embed them), share link, CSV, PNG image, native share, "sort this list" links for friends.
- Motion: picks animate (winner punches forward, loser drops, next pair slides in) and results count down into place. "Play recap" opens a Spotify Wrapped-style 9:16 story built with Remotion: intro, stats, toughest and easiest pick, countdown of the top 5 with each song playing, and a "My top 5" card you can save as an image. Remotion is free for individuals and companies of up to 3 people; larger companies need a Remotion license.
- Multiple sorts saved locally with progress, keyboard shortcuts (`←` `→` pick, `↓` tie, `↑` undo, `Esc` leave), light and dark themes.

## Development

```bash
bun install
bun run dev
bun run test
bun run build
```

## Deploy

`dist/` is a static site with relative asset paths and hash routing, so it works from any host or subpath. The included workflow (`.github/workflows/deploy.yml`) publishes it to GitHub Pages on pushes to `main`; enable Pages with the "GitHub Actions" source in the repository settings.
