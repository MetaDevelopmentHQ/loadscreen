# Configuration (config.lua)

Almost every visual setting is edited in-game and saved to `data/theme.json`. `config.lua` holds the server settings that should not be changed from inside the game.

## General

| Setting | Default | Description |
|---|---|---|
| `Config.Locale` | `'tr'` | Interface language: `'tr'` or `'en'`. Also decides which scheduled themes appear. |
| `Config.Command` | `'loadscreen'` | Command that opens the editor. |

## Permissions

| Setting | Default | Description |
|---|---|---|
| `Config.Framework` | `'auto'` | `'auto'`, `'esx'`, `'qb'`, `'qbox'` or `'standalone'`. Used only for admin checks. |
| `Config.AcePermission` | `'metadev.loadscreen.admin'` | Anyone with this ACE may use the editor. |
| `Config.AdminGroups` | `{ 'admin', 'superadmin', 'god' }` | Framework groups that may use the editor. |

Permissions are always checked **on the server**. Every editor request (save, import, restore) is checked and validated again on the server.

## Time

| Setting | Default | Description |
|---|---|---|
| `Config.Timezone` | `'Europe/Istanbul'` | IANA timezone used to pick the scheduled theme. |
| `Config.UtcOffset` | `3` | UTC offset of the same zone, used to split statistics into days and as a fallback. |

## Credit

| Setting | Default | Description |
|---|---|---|
| `Config.ShowCredit` | `true` | The faint "MADE BY METADEV" in the corner. Keeping it on is appreciated. |
| `Config.CreditUrl` | Discord link | Opened in the player's browser when the credit is clicked. |

## Closing

| Setting | Default | Description |
|---|---|---|
| `Config.Shutdown.FadeMs` | `800` | Fade-out length (ms). |
| `Config.Shutdown.Events` | `playerSpawned`, `esx:playerLoaded`, `QBCore:Client:OnPlayerLoaded` | Events that mean "the player is in the game". The first one closes the screen. |
| `Config.Shutdown.FallbackSeconds` | `45` | Closes anyway this long after the network session starts. `0` disables it. |

If you use a character selection screen, add the event that fires when it opens (most multicharacter scripts close the loading screen themselves).

## Statistics

| Setting | Default | Description |
|---|---|---|
| `Config.Stats.RetentionDays` | `30` | Daily data older than this is folded into one summary. |
| `Config.Stats.MinLoadSeconds` / `MaxLoadSeconds` | `3` / `1200` | Times outside this range are ignored as outliers. |
| `Config.Stats.SaveInterval` | `60` | How often statistics are written to disk (s). |

## Scheduled themes

| Setting | Description |
|---|---|
| `Config.ScheduledThemesEnabled` | Turns all scheduled themes on or off. |
| `Config.ScheduledThemes` | Per day: `enabled`, `badge`, `message`, `playlist`. See [Scheduled themes](scheduled-themes.md). |

## Debug

| Setting | Description |
|---|---|
| `Config.Debug.ForceDate` | A date like `'2026-07-04'` makes the loading screen pretend today is that day. Use it to test scheduled themes. |
| `Config.Debug.Verbose` | Prints load times to the console. |

## Adding a language

1. Copy `locales/en.json` to `locales/de.json` and translate it (set `meta.intl` to `de-DE`).
2. Copy `locales/en.lua` to `locales/de.lua` and rename the table to `Locales['de']`.
3. Set `Config.Locale = 'de'`.

Common holidays (New Year, Valentine's Day…) appear automatically in a new language. Translate their texts in the `holidays` section.
