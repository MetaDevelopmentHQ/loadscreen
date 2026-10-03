# Theme editor

Type `/loadscreen` in game. Without permission you get a chat message instead.

The editor has three parts:

- **Left panel:** settings, with tabs at the top.
- **Centre:** a 1920×1080 live preview. It is drawn by the same code as the real loading screen, so what you see is exactly what players get.
- **Bottom:** a summary of your choices and the scheduled theme for the preview date.

Changes are kept in a draft. **Save** sends the draft to the server, which validates it, writes `data/theme.json`, and serves it from the next connection on. No restart needed. **Reset** discards unsaved changes. `Esc` closes the editor and asks first if you have unsaved changes.

## Tabs

### Design
- **Gallery:** Glass or Minimal. A preset applies its layout, accent and font together (texts are untouched).
- **Accent color:** 6 presets or any `#RRGGBB`.
- **Title font:** Syne, Manrope or Instrument Serif.
- **Modules:** personal welcome, music, cards, player count, estimated time.

### Content
Server name (big title), full name (top left), badge line, tagline and cards (Rules, Updates, Tips; up to 8 each). Glass shows the first 4 items per tab. Minimal rotates through all of them.

### Media
- **Background:** `media/…` or `https://…`. The type is detected automatically (`.webm` → video). Use WebM for video.
- **Logo:** if empty, the initials of the full name are shown.
- **Suggest colors from logo:** extracts the dominant colors and proposes 3 accents that are readable on the dark background. The first one is recommended; click to apply. Remote images need CORS; otherwise put the logo in `web/media/logo/`.
- **Music:** default volume, shuffle and the playlist (up to 25 songs). With an empty playlist the music card is hidden.

### Calendar
Lists scheduled themes. Turn each day on or off and change its badge and message. **Preview date** shows any day's theme in the preview; it is not saved.

### Share
- **Copy code:** turns your theme into a code starting with `MDLS1:`. Media files are not included, only `https://` links.
- **Import from code:** paste a code. It is validated on the server first and then applied to your draft. Fields the code doesn't contain (e.g. a local background) keep your current values. Press **Save** to apply.

### History
The last 5 saves with time and author. **Restore** brings one back; this also counts as a new save.

### Stats
Average, fastest and slowest load time, joins today and a chart of the last 7 days. Daily data older than 30 days is rolled up into one summary.

## Security

- Opening, saving, importing and restoring are permission-checked on the server every single time.
- The server rebuilds the incoming theme field by field: unknown fields are dropped, colors must be hex, texts are length-limited, and URLs must be `https://` or `media/`.
- Requests are rate-limited per player.
