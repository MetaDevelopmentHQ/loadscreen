# FAQ

**The loading screen never closes.**
Your spawn script probably fires none of the events in `Config.Shutdown.Events`. Add your own spawn event. Even without changes it closes after `FallbackSeconds` (45 s by default).

**The character selection is hidden behind the loading screen.**
Add the event your multicharacter script fires when it opens to `Config.Shutdown.Events`. If the script calls `ShutdownLoadingScreenNui()` itself, nothing is needed.

**No music.**
With an empty playlist the music card is hidden. Add songs in Editor → Media. After adding local files, restart the resource. Links must be `https://` and not Discord CDN.

**The video background stays black.**
Use WebM. FiveM's browser may not play H.264 MP4 reliably.

**My background disappeared after a few days.**
You probably used a Discord CDN link; they expire. Put the file in `web/media/`.

**I saved but nothing changed.**
Changes apply from the next connection; players already on the loading screen keep the old theme. If the console says it couldn't write a file, give FXServer write access to `data/`.

**`/loadscreen` says I have no permission.**
Add `add_ace group.admin metadev.loadscreen.admin allow` and put yourself in that group, or list your framework group in `Config.AdminGroups`.

**No estimated time is shown.**
No load has been recorded yet. The average appears after the first player fully spawns. Also check that the "Estimated time" module is on.

**"Suggest colors from logo" fails with a CORS message.**
The remote host doesn't allow reading the image. Put the logo in `web/media/logo/` and use the local path.

**I don't see any effects.**
If the player's system has "reduce motion" enabled, effects are turned off on purpose (`prefers-reduced-motion`). Remembrance days have no effects either.

**Can I remove "MADE BY METADEV"?**
Yes, `Config.ShowCredit = false`. Keeping it is a big help for this free project.

**Do I need a framework?**
No. A framework is only used for admin group checks. Standalone, the ACE permission is enough.
