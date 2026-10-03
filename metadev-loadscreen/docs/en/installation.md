# Installation

## Requirements

- A recent FXServer (cerulean, Lua 5.4).
- No framework required. ESX, QBCore or Qbox are detected automatically and used only for admin checks.
- No Node.js and no build step.

## Steps

1. Copy the folder to `resources/metadev-loadscreen`. Keep that folder name: the editor's NUI calls use it.
2. Add to `server.cfg`:
   ```cfg
   ensure metadev-loadscreen
   ```
3. Decide who may open the editor (pick one):
   ```cfg
   # ACE group
   add_ace group.admin metadev.loadscreen.admin allow
   add_principal identifier.license:XXXXXXXX group.admin

   # or framework groups: config.lua → Config.AdminGroups
   ```
4. Remove any other loading screen resource. Only one `loadscreen` can run at a time.
5. Make sure FXServer can write to `data/` (theme, history and statistics are stored there).

## First run

- The server console prints something like
  `[metadev-loadscreen] v1.0.0 started · locale: en · permission bridge: standalone`
- Join, type `/loadscreen`, and the editor opens. `data/theme.json` is created on the first save.
- Set `Config.Locale = 'en'` for English texts and US holidays.

## Updating

Keep your `data/` folder and replace everything else. Your theme, history and statistics are kept.

## Adding your own media

1. Put files in `web/media/` (backgrounds), `web/media/logo/` or `web/media/music/`.
2. Restart the resource. FiveM packs resource files when the resource starts.
3. In the editor, enter the path as `media/my-background.webp`.

For remote files, use a permanent `https://` link. **Discord CDN links expire and will stop working.** Use **WebM** for video; FiveM's browser may not play H.264 MP4 reliably.
