--[[
    MetaDev Loadscreen · server/theme_store.lua

    Owns data/theme.json and data/history/.

    Everything that comes from a client (editor saves, imported theme codes)
    goes through ThemeStore.Sanitize(): the output is rebuilt field by field
    from a fixed schema, so unknown fields are dropped, colors must be hex,
    texts are trimmed and length-limited, and media must be either a local
    file under web/media/ or an https:// URL.
]]

ThemeStore = {}

local RESOURCE = GetCurrentResourceName()
local THEME_FILE = 'data/theme.json'
local HISTORY_INDEX = 'data/history/index.json'
local HISTORY_SLOT = 'data/history/slot%d.json'
local HISTORY_SIZE = 5
local THEME_VERSION = 1

local LIMITS = {
    serverName = 32,
    serverLabel = 48,
    badge = 60,
    slogan = 160,
    cardTitle = 60,
    cardBody = 220,
    cardsPerTab = 8,
    trackTitle = 80,
    trackArtist = 60,
    playlist = 25,
    url = 512,
    holidayBadge = 80,
    holidayMessage = 220,
}

local LAYOUTS = { glass = true, minimal = true }
local FONTS = { syne = true, manrope = true, serif = true }
local BACKGROUND_TYPES = { auto = true, image = true, video = true }
local MODULES = { 'welcome', 'music', 'cards', 'players', 'eta' }
local CARD_CATEGORIES = { 'rules', 'updates', 'tips' }

local current       -- sanitized theme currently in use
local localeDefaults -- `defaults` block of locales/<lang>.json

---------------------------------------------------------------------------
-- File helpers
---------------------------------------------------------------------------

local function readJson(path)
    local raw = LoadResourceFile(RESOURCE, path)
    if not raw or raw == '' then return nil end
    local ok, decoded = pcall(json.decode, raw)
    return ok and decoded or nil
end

local function writeJson(path, value)
    local ok, encoded = pcall(json.encode, value, { indent = true })
    if not ok then encoded = json.encode(value) end
    local written = SaveResourceFile(RESOURCE, path, encoded, -1)
    if not written then
        print(('^1[metadev-loadscreen]^7 %s'):format(L('write_failed', path)))
    end
    return written
end

---------------------------------------------------------------------------
-- Field validators. Each returns a clean value or the given fallback.
---------------------------------------------------------------------------

local function trim(value)
    return (value:gsub('^%s+', ''):gsub('%s+$', ''))
end

---Single-line text: control characters removed, valid UTF-8, length-capped.
local function cleanText(value, maxLength, fallback)
    if type(value) ~= 'string' then return fallback end
    value = trim(value:gsub('%c', ' '))
    local length = utf8.len(value)
    if not length then return fallback end -- invalid UTF-8
    if length > maxLength then
        value = trim(value:sub(1, utf8.offset(value, maxLength + 1) - 1))
    end
    return value
end

local function cleanHex(value, fallback)
    if type(value) == 'string' and value:match('^#%x%x%x%x%x%x$') then
        return value:upper()
    end
    return fallback
end

local function cleanBool(value, fallback)
    if type(value) == 'boolean' then return value end
    return fallback
end

local function cleanNumber(value, min, max, fallback)
    value = tonumber(value)
    if not value or value ~= value then return fallback end -- nil or NaN
    return math.min(max, math.max(min, value))
end

local function cleanEnum(value, allowed, fallback)
    if type(value) == 'string' and allowed[value] then return value end
    return fallback
end

---Media reference: '' (none), a local file under web/media/, or an https URL.
---Returns nil when the value is present but not acceptable.
local function cleanMedia(value)
    if value == nil then return nil end
    if type(value) ~= 'string' then return nil end
    value = trim(value)
    if value == '' then return '' end
    if #value > LIMITS.url then return nil end
    -- Characters that could escape an attribute or a CSS url() are never needed.
    if value:find('[%s"\'<>\\`%(%){}|^]') then return nil end

    if value:match('^https://[%w%-%.]+[%w%-%._~:/%?#%[%]@!%$&%*%+,;=%%]*$') then
        return value
    end
    if value:match('^media/[%w%-_%./]+$') and not value:find('%.%.') then
        return value
    end
    return nil
end

local function cleanList(value, maxItems, cleanItem)
    local out = {}
    if type(value) ~= 'table' then return out end
    for i = 1, math.min(#value, maxItems) do
        local item = cleanItem(value[i])
        if item then out[#out + 1] = item end
    end
    return out
end

local function cleanCard(value)
    if type(value) ~= 'table' then return nil end
    local card = {
        title = cleanText(value.title, LIMITS.cardTitle, ''),
        body = cleanText(value.body, LIMITS.cardBody, ''),
    }
    if card.title == '' and card.body == '' then return nil end
    return card
end

local function cleanTrack(value)
    if type(value) ~= 'table' then return nil end
    local src = cleanMedia(value.src)
    if not src or src == '' then return nil end
    return {
        title = cleanText(value.title, LIMITS.trackTitle, ''),
        artist = cleanText(value.artist, LIMITS.trackArtist, ''),
        src = src,
    }
end

---Editor overrides for scheduled themes. Only ids from Config.ScheduledThemes.
local function cleanSchedule(value)
    local out = {}
    if type(value) ~= 'table' then return out end
    for id in pairs(Config.ScheduledThemes) do
        local entry = value[id]
        if type(entry) == 'table' then
            local clean = {}
            if type(entry.enabled) == 'boolean' then clean.enabled = entry.enabled end
            local badge = cleanText(entry.badge, LIMITS.holidayBadge, '')
            local message = cleanText(entry.message, LIMITS.holidayMessage, '')
            if badge ~= '' then clean.badge = badge end
            if message ~= '' then clean.message = message end
            if next(clean) then out[id] = clean end
        end
    end
    return out
end

---------------------------------------------------------------------------
-- Defaults
---------------------------------------------------------------------------

local function getLocaleDefaults()
    if not localeDefaults then
        local locale = readJson(('locales/%s.json'):format(Config.Locale)) or readJson('locales/en.json') or {}
        localeDefaults = type(locale.defaults) == 'table' and locale.defaults or {}
    end
    return localeDefaults
end

---The out-of-the-box theme. Texts come from the active locale's `defaults`.
---Mirrors buildDefaultTheme() in web/js/themes.js.
function ThemeStore.Default()
    local defaults = getLocaleDefaults()
    local cards = type(defaults.cards) == 'table' and defaults.cards or {}
    return {
        version = THEME_VERSION,
        layout = 'glass',
        accent = '#F5B544',
        font = 'syne',
        modules = { welcome = true, music = true, cards = true, players = true, eta = true },
        serverName = cleanText(defaults.serverName, LIMITS.serverName, 'MetaV'),
        serverLabel = cleanText(defaults.serverLabel, LIMITS.serverLabel, 'MetaV Roleplay'),
        badge = cleanText(defaults.badge, LIMITS.badge, ''),
        slogan = cleanText(defaults.slogan, LIMITS.slogan, ''),
        logo = '',
        background = { src = 'media/background.webp', type = 'auto' },
        cards = {
            interval = 8,
            rules = cleanList(cards.rules, LIMITS.cardsPerTab, cleanCard),
            updates = cleanList(cards.updates, LIMITS.cardsPerTab, cleanCard),
            tips = cleanList(cards.tips, LIMITS.cardsPerTab, cleanCard),
        },
        playlist = {},
        music = { volume = 0.4, shuffle = false },
        schedule = {},
    }
end

---------------------------------------------------------------------------
-- Sanitizing
---------------------------------------------------------------------------

---Rebuilds a theme from untrusted input.
---Missing fields are taken from `base`; invalid ones too, and are reported.
---@param input table|nil  untrusted theme (possibly partial)
---@param base table|nil   fallback values (defaults to the current theme)
---@return table theme, string[] warnings
function ThemeStore.Sanitize(input, base)
    base = base or ThemeStore.Get()
    if type(input) ~= 'table' then input = {} end
    local warnings = {}

    local function pick(field, value, fallback)
        if value == nil then
            if input[field] ~= nil then warnings[#warnings + 1] = field end
            return fallback
        end
        return value
    end

    local modulesIn = type(input.modules) == 'table' and input.modules or {}
    local modules = {}
    for _, key in ipairs(MODULES) do
        modules[key] = cleanBool(modulesIn[key], base.modules[key])
    end

    local cardsIn = type(input.cards) == 'table' and input.cards or {}
    local cards = { interval = math.floor(cleanNumber(cardsIn.interval, 3, 60, base.cards.interval)) }
    for _, category in ipairs(CARD_CATEGORIES) do
        if cardsIn[category] ~= nil then
            cards[category] = cleanList(cardsIn[category], LIMITS.cardsPerTab, cleanCard)
        else
            cards[category] = base.cards[category]
        end
    end

    local backgroundIn = type(input.background) == 'table' and input.background or {}
    local backgroundSrc = cleanMedia(backgroundIn.src)
    if backgroundIn.src ~= nil and backgroundSrc == nil then warnings[#warnings + 1] = 'background.src' end

    local logo = cleanMedia(input.logo)
    if input.logo ~= nil and logo == nil then warnings[#warnings + 1] = 'logo' end

    local musicIn = type(input.music) == 'table' and input.music or {}
    local playlist = base.playlist
    if input.playlist ~= nil then
        playlist = cleanList(input.playlist, LIMITS.playlist, cleanTrack)
        if type(input.playlist) == 'table' and #playlist < math.min(#input.playlist, LIMITS.playlist) then
            warnings[#warnings + 1] = 'playlist'
        end
    end

    local theme = {
        version = THEME_VERSION,
        layout = pick('layout', cleanEnum(input.layout, LAYOUTS, nil), base.layout),
        accent = pick('accent', cleanHex(input.accent, nil), base.accent),
        font = pick('font', cleanEnum(input.font, FONTS, nil), base.font),
        modules = modules,
        serverName = cleanText(input.serverName, LIMITS.serverName, base.serverName),
        serverLabel = cleanText(input.serverLabel, LIMITS.serverLabel, base.serverLabel),
        badge = cleanText(input.badge, LIMITS.badge, base.badge),
        slogan = cleanText(input.slogan, LIMITS.slogan, base.slogan),
        logo = logo or base.logo,
        background = {
            src = backgroundSrc or base.background.src,
            type = cleanEnum(backgroundIn.type, BACKGROUND_TYPES, base.background.type),
        },
        cards = cards,
        playlist = playlist,
        music = {
            volume = cleanNumber(musicIn.volume, 0, 1, base.music.volume),
            shuffle = cleanBool(musicIn.shuffle, base.music.shuffle),
        },
        schedule = input.schedule ~= nil and cleanSchedule(input.schedule) or base.schedule,
    }

    -- The big title must never be empty.
    if theme.serverName == '' then theme.serverName = base.serverName end

    return theme, warnings
end

---Validates a playlist from config.lua (scheduled-theme music).
function ThemeStore.CleanPlaylist(value)
    return cleanList(value, LIMITS.playlist, cleanTrack)
end

---------------------------------------------------------------------------
-- Current theme
---------------------------------------------------------------------------

function ThemeStore.Load()
    local defaults = ThemeStore.Default()
    local stored = readJson(THEME_FILE)
    if stored == nil and LoadResourceFile(RESOURCE, THEME_FILE) then
        print(('^3[metadev-loadscreen]^7 %s'):format(L('theme_invalid_file')))
    end
    current = ThemeStore.Sanitize(stored, defaults)
    return current
end

function ThemeStore.Get()
    return current or ThemeStore.Load()
end

---------------------------------------------------------------------------
-- History (fixed slots, so nothing ever needs deleting)
---------------------------------------------------------------------------

local function readIndex()
    local index = readJson(HISTORY_INDEX)
    if type(index) ~= 'table' or type(index.entries) ~= 'table' then
        index = { nextSlot = 1, entries = {} }
    end
    return index
end

local function pushHistory(theme, author, kind)
    local index = readIndex()
    local slot = tonumber(index.nextSlot) or 1
    if slot < 1 or slot > HISTORY_SIZE then slot = 1 end

    local id = ('%d-%04d'):format(os.time(), math.random(0, 9999))
    if not writeJson(HISTORY_SLOT:format(slot), { id = id, theme = theme }) then return end

    local entries = { { id = id, slot = slot, savedAt = os.time(), author = author, kind = kind } }
    for _, entry in ipairs(index.entries) do
        if entry.slot ~= slot and #entries < HISTORY_SIZE then entries[#entries + 1] = entry end
    end

    writeJson(HISTORY_INDEX, { nextSlot = slot % HISTORY_SIZE + 1, entries = entries })
end

---Newest first: { id, savedAt, author, kind }
function ThemeStore.History()
    local list = {}
    for _, entry in ipairs(readIndex().entries) do
        list[#list + 1] = { id = entry.id, savedAt = entry.savedAt, author = entry.author, kind = entry.kind }
    end
    return list
end

---------------------------------------------------------------------------
-- Saving
---------------------------------------------------------------------------

---Validates and stores a theme. The next connecting player receives it.
---@return boolean ok, table|string themeOrError, string[]|nil warnings
function ThemeStore.Save(input, author, kind)
    local theme, warnings = ThemeStore.Sanitize(input, ThemeStore.Get())
    if not writeJson(THEME_FILE, theme) then
        return false, 'write_failed'
    end
    current = theme
    pushHistory(theme, cleanText(author, 48, '?'), kind or 'save')
    return true, theme, warnings
end

---Brings back a theme from history (stored as a new save).
function ThemeStore.Restore(id, author)
    if type(id) ~= 'string' then return false, 'invalid_payload' end
    for _, entry in ipairs(readIndex().entries) do
        if entry.id == id then
            local snapshot = readJson(HISTORY_SLOT:format(entry.slot))
            if type(snapshot) ~= 'table' or snapshot.id ~= id then break end
            return ThemeStore.Save(snapshot.theme, author, 'restore')
        end
    end
    return false, 'not_found'
end
