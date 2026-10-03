--[[
    MetaDev Loadscreen · config.lua

    Most visual settings (layout, colors, texts, cards, playlist) are edited
    in-game with /loadscreen and stored in data/theme.json. This file holds
    the server-side settings that should not be changed from inside the game.

    Full reference: docs/tr/yapilandirma.md · docs/en/configuration.md
]]

Config = {}

-- Interface language: 'tr' or 'en'. Adding a language = adding
-- locales/<code>.lua and locales/<code>.json (see docs).
Config.Locale = 'tr'

---------------------------------------------------------------------------
-- Permissions
---------------------------------------------------------------------------

-- 'auto' | 'esx' | 'qb' | 'qbox' | 'standalone'
-- The framework is ONLY used to check admin groups. Everything else works
-- without one.
Config.Framework = 'auto'

-- ACE permission that grants editor access, e.g. in server.cfg:
--   add_ace group.admin metadev.loadscreen.admin allow
Config.AcePermission = 'metadev.loadscreen.admin'

-- Framework groups that may open the editor (in addition to the ACE above).
Config.AdminGroups = { 'admin', 'superadmin', 'god' }

-- Chat command that opens the editor.
Config.Command = 'loadscreen'

---------------------------------------------------------------------------
-- Time
---------------------------------------------------------------------------

-- IANA timezone used to decide which scheduled theme is active.
Config.Timezone = 'Europe/Istanbul'

-- Hours from UTC for the same timezone. Lua has no timezone database, so the
-- server uses this to split statistics into days. It is also the fallback if
-- a player's browser does not know Config.Timezone.
Config.UtcOffset = 3

---------------------------------------------------------------------------
-- Signature
---------------------------------------------------------------------------

-- The faint "MADE BY METADEV" in the corner. Keeping it on is appreciated:
-- it's how other server owners find this free resource.
Config.ShowCredit = true
Config.CreditUrl = 'https://discord.gg/metadev' -- MetaDev Discord (placeholder)

---------------------------------------------------------------------------
-- Closing the loading screen
---------------------------------------------------------------------------

Config.Shutdown = {
    -- Fade-out length in milliseconds.
    FadeMs = 800,

    -- Events that mean "the player is in the game". The first one wins.
    -- 'playerSpawned' comes from spawnmanager; the others from frameworks.
    Events = {
        'playerSpawned',
        'esx:playerLoaded',
        'QBCore:Client:OnPlayerLoaded',
    },

    -- Safety net: close anyway this many seconds after the network session is
    -- active (for servers whose spawn script fires none of the events above).
    -- 0 disables it.
    FallbackSeconds = 45,
}

---------------------------------------------------------------------------
-- Statistics (used for the estimated time and the editor's stats tab)
---------------------------------------------------------------------------

Config.Stats = {
    -- Daily statistics older than this are folded into a single summary.
    RetentionDays = 30,

    -- Load times outside this window (seconds) are ignored as outliers.
    MinLoadSeconds = 3,
    MaxLoadSeconds = 1200,

    -- How often (seconds) pending statistics are written to data/stats.json.
    SaveInterval = 60,
}

---------------------------------------------------------------------------
-- Scheduled themes
---------------------------------------------------------------------------

-- Master switch for all scheduled themes.
Config.ScheduledThemesEnabled = true

--[[
    Every scheduled theme, by id. Per day you can set:
      enabled  = false              -- turn this day off
      badge    = 'TEXT'             -- replace the badge line
      message  = 'Text {years}'     -- replace the message ({years}, {days}, {year}, {nextYear})
      playlist = { { title = '', artist = '', src = 'media/music/x.mp3' } }  -- music just for this day

    Settings saved from the in-game editor (Calendar tab) take precedence.
    Which days appear depends on Config.Locale:
      common → every language · tr → only 'tr' · en → only 'en'
]]
Config.ScheduledThemes = {
    -- Common
    ['new-year']         = { enabled = true },   -- 25–31 Dec
    ['valentines']       = { enabled = true },   -- 14 Feb
    ['womens-day']       = { enabled = true },   -- 8 Mar
    ['april-fools']      = { enabled = true },   -- 1 Apr
    ['mothers-day']      = { enabled = true },   -- 2nd Sunday of May
    ['fathers-day']      = { enabled = true },   -- 3rd Sunday of June
    ['community-day']    = { enabled = true },   -- 17 Sep
    ['halloween']        = { enabled = true },   -- 24 Oct – 1 Nov
    ['black-friday']     = { enabled = true },   -- Friday after Thanksgiving

    -- Turkish only
    ['canakkale']        = { enabled = true },   -- 18 Mar (remembrance)
    ['childrens-day']    = { enabled = true },   -- 23 Apr
    ['labour-day']       = { enabled = true },   -- 1 May
    ['youth-day']        = { enabled = true },   -- 19 May
    ['democracy-day']    = { enabled = true },   -- 15 Jul (remembrance)
    ['victory-day']      = { enabled = true },   -- 30 Aug
    ['republic-day']     = { enabled = true },   -- 28–30 Oct
    ['ataturk-memorial'] = { enabled = true },   -- 10 Nov (remembrance)
    ['teachers-day']     = { enabled = true },   -- 24 Nov

    -- English only
    ['st-patricks']      = { enabled = true },   -- 17 Mar
    ['easter']           = { enabled = true },   -- Easter Sunday
    ['memorial-day']     = { enabled = true },   -- last Monday of May (remembrance)
    ['independence-day'] = { enabled = true },   -- 4 Jul
    ['labor-day']        = { enabled = true },   -- 1st Monday of September
    ['veterans-day']     = { enabled = true },   -- 11 Nov (remembrance)
    ['thanksgiving']     = { enabled = true },   -- 4th Thursday of November
    ['christmas']        = { enabled = true },   -- 18–24 Dec
}

---------------------------------------------------------------------------
-- Debug
---------------------------------------------------------------------------

Config.Debug = {
    -- Pretend today is this date ('YYYY-MM-DD') to test scheduled themes,
    -- e.g. '2026-10-29' for Republic Day. nil = real date.
    ForceDate = nil,

    -- Print extra information to the server console.
    Verbose = false,
}
