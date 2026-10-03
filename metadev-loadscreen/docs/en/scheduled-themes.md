# Scheduled themes

On certain days the loading screen switches to a special look by itself. A scheduled theme is layered **on top of** your theme: only the accent, tint, effect, badge, message and (optionally) music change. Layout, logo and server name stay the same.

## Language rule

- **Common** days appear in every language, in that language.
- **TR** days appear only with `Config.Locale = 'tr'`.
- **EN** days appear only with `Config.Locale = 'en'`.

## Priority

If two themes fall on the same day, the higher `priority` wins. National and remembrance days (80–100) beat celebrations (20–60). For example, in Turkish, Republic Day replaces Halloween on 28–30 October.

## Days

| Day | Date | Scope | Effect |
|---|---|---|---|
| New Year | 25–31 Dec | Common | snow, countdown |
| Valentine's Day | 14 Feb | Common | hearts |
| International Women's Day | 8 Mar | Common | purple confetti |
| April Fools' | 1 Apr | Common | rainbow confetti, server name tilted −4° |
| Mother's Day | 2nd Sunday of May | Common | hearts |
| Father's Day | 3rd Sunday of June | Common | none |
| Community Day | 17 Sep | Common | green, white and gold confetti |
| Halloween | 24 Oct – 1 Nov | Common | embers |
| Black Friday | Friday after Thanksgiving | Common | none |
| St. Patrick's Day | 17 Mar | EN | green confetti, shamrock |
| Easter | Easter Sunday (Computus) | EN | pastel confetti |
| Memorial Day | last Monday of May | EN | remembrance |
| Independence Day | 4 Jul | EN | red, white and blue confetti |
| Labor Day | 1st Monday of September | EN | US flag |
| Veterans Day | 11 Nov | EN | remembrance |
| Thanksgiving | 4th Thursday of November | EN | leaves |
| Christmas | 18–24 Dec | EN | snow |
| Turkish national days | see [docs/tr](../tr/zamanlanmis-temalar.md) | TR | |

## Remembrance mode

On remembrance days (`mode: 'remembrance'`) the photo is 75 % greyscale (100 % on 10 November), there are no effects, the music is off, and the music card reads "Music is off today out of respect."

## Variables

| Variable | Meaning |
|---|---|
| `{years}` | Anniversary count, e.g. Community Day (GTA V): year − 2013, Independence Day: year − 1776 |
| `{days}` | Days until 1 January |
| `{year}` / `{nextYear}` | This year / next year |

## Customizing

In **config.lua**:

```lua
Config.ScheduledThemes['halloween'] = { enabled = false }
Config.ScheduledThemes['independence-day'] = {
    enabled = true,
    message = 'Happy {years}th birthday, America! Fireworks over the pier at 9 PM.',
    playlist = { { title = 'Anthem', artist = '', src = 'media/music/anthem.mp3' } },
}
```

In the **editor**: *Calendar* tab, toggle a day or change its badge and message. Editor changes override `config.lua`.

To disable everything: `Config.ScheduledThemesEnabled = false`.

## Testing

```lua
Config.Debug = { ForceDate = '2026-07-04' }
```

Restart the resource and connect. In the editor, *Calendar → Preview date* previews any day without a restart.

In a browser (without FiveM): serve the resource folder with `python -m http.server` and open
`http://localhost:8000/web/loadscreen.html?date=2026-11-26&locale=en&layout=minimal`.

Calendar tests: `node web/js/calendar.test.mjs`
