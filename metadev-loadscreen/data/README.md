# data/

Written by the server at runtime. You normally never edit these by hand.

| File | Contents |
|---|---|
| `theme.json` | The active theme, saved from the in-game editor. Created on the first save. Delete it to go back to the default theme. |
| `history/slot1-5.json`, `history/index.json` | The last 5 saves, used by the editor's History tab. |
| `stats.json` | Load-time statistics. Players are stored by a hash of their license, never the license itself. |

The folder must be writable by the FXServer process.
