--[[
    MetaDev Loadscreen · server/main.lua

    1. playerConnecting → deferrals.handover(): everything the loading screen
       needs (theme, date, language, player count, estimated time).
    2. Editor command and a small request/response channel for the editor.
       Every request is rate-limited and permission-checked here, on the
       server, no matter what the client claims.
    3. Load-time reports from clients (for the estimate and statistics).
]]

local RESOURCE = GetCurrentResourceName()
local VERSION = GetResourceMetadata(RESOURCE, 'version', 0) or '1.0.0'

local EVENT = {
    request = 'metadev-loadscreen:server:request',
    loaded = 'metadev-loadscreen:server:loaded',
    response = 'metadev-loadscreen:client:response',
    openEditor = 'metadev-loadscreen:client:openEditor',
}

-- Latent events stream large payloads (a full theme) without hitching.
local LATENT_BPS = 200000

local RATE_LIMIT = { window = 5000, max = 12 }

---------------------------------------------------------------------------
-- Helpers
---------------------------------------------------------------------------

local function log(message)
    print(('^5[metadev-loadscreen]^7 %s'):format(message))
end

local function getLicense(source)
    if GetPlayerIdentifierByType then
        local license = GetPlayerIdentifierByType(source, 'license')
        if license then return license end
    end
    for _, identifier in ipairs(GetPlayerIdentifiers(source) or {}) do
        if identifier:sub(1, 8) == 'license:' then return identifier end
    end
    return nil
end

local function playerName(source)
    return GetPlayerName(source) or L('unknown_player')
end

---Player names are shown on the loading screen: keep them short and printable.
local function displayName(name)
    if type(name) ~= 'string' then return nil end
    name = name:gsub('%c', ''):gsub('^%s+', ''):gsub('%s+$', '')
    if name == '' or not utf8.len(name) then return nil end
    if utf8.len(name) > 32 then name = name:sub(1, utf8.offset(name, 33) - 1) end
    return name
end

local function forcedDate()
    local value = Config.Debug and Config.Debug.ForceDate
    if type(value) == 'string' and value:match('^%d%d%d%d%-%d%d%-%d%d$') then return value end
    return nil
end

---Scheduled-theme settings: config.lua first, then editor overrides on top.
local function scheduleOverrides(theme)
    local merged = {}
    for id, cfg in pairs(Config.ScheduledThemes) do
        local entry = {
            enabled = cfg.enabled ~= false,
            badge = type(cfg.badge) == 'string' and cfg.badge or nil,
            message = type(cfg.message) == 'string' and cfg.message or nil,
        }
        if cfg.playlist then
            local playlist = ThemeStore.CleanPlaylist(cfg.playlist)
            if #playlist > 0 then entry.playlist = playlist end
        end

        local edited = theme.schedule and theme.schedule[id]
        if edited then
            if edited.enabled ~= nil then entry.enabled = edited.enabled end
            entry.badge = edited.badge or entry.badge
            entry.message = edited.message or entry.message
        end
        merged[id] = entry
    end
    return merged
end

---Config-only part of the schedule, so the editor can show what config.lua says.
local function scheduleConfig()
    local out = {}
    for id, cfg in pairs(Config.ScheduledThemes) do
        out[id] = {
            enabled = cfg.enabled ~= false,
            badge = type(cfg.badge) == 'string' and cfg.badge or nil,
            message = type(cfg.message) == 'string' and cfg.message or nil,
        }
    end
    return out
end

local function sharedTimeInfo()
    return {
        locale = Config.Locale,
        now = os.time(),
        timezone = Config.Timezone,
        utcOffset = Config.UtcOffset,
        forceDate = forcedDate(),
    }
end

---------------------------------------------------------------------------
-- 1. Handover to the loading screen
---------------------------------------------------------------------------

local function buildHandover(name, license)
    local theme = ThemeStore.Get()
    local payload = sharedTimeInfo()
    payload.v = 1
    payload.theme = theme
    payload.schedule = { enabled = Config.ScheduledThemesEnabled ~= false, overrides = scheduleOverrides(theme) }
    payload.players = { online = #GetPlayers(), max = GetConvarInt('sv_maxclients', 48) }
    payload.eta = Stats.EstimateFor(license)
    payload.welcome = { name = displayName(name), lastSeen = license and Stats.LastSeen(license) or nil }
    payload.credit = { show = Config.ShowCredit ~= false, url = Config.CreditUrl }
    return payload
end

AddEventHandler('playerConnecting', function(name, _, deferrals)
    local source = source
    local license = getLicense(source)

    deferrals.defer()
    Wait(0)

    if license then Stats.MarkConnecting(license) end

    local ok, payload = pcall(buildHandover, name, license)
    if ok then
        deferrals.handover({ metadev = payload })
    else
        log(('^1handover failed:^7 %s'):format(payload))
    end

    deferrals.done()
end)

---------------------------------------------------------------------------
-- 2. Editor
---------------------------------------------------------------------------

local function editorPayload()
    local payload = sharedTimeInfo()
    payload.version = VERSION
    payload.theme = ThemeStore.Get()
    payload.history = ThemeStore.History()
    payload.stats = Stats.Summary()
    payload.schedule = { enabled = Config.ScheduledThemesEnabled ~= false, config = scheduleConfig() }
    return payload
end

RegisterCommand(Config.Command, function(source)
    if source == 0 then
        log(L('editor_console', Config.Command))
        return
    end
    if not Permissions.IsAdmin(source) then
        TriggerClientEvent('chat:addMessage', source, { args = { 'MetaDev', L('editor_no_permission') } })
        return
    end
    TriggerLatentClientEvent(EVENT.openEditor, source, LATENT_BPS, editorPayload())
end, false)

---Editor request handlers. Each receives (source, payload) and returns a result table.
local handlers = {}

function handlers.refresh()
    return { ok = true, data = editorPayload() }
end

---Runs an untrusted theme through validation without saving (used for imports).
function handlers.validate(_, payload)
    local theme, warnings = ThemeStore.Sanitize(payload.theme, ThemeStore.Get())
    return { ok = true, theme = theme, warnings = warnings }
end

function handlers.save(source, payload)
    if type(payload.theme) ~= 'table' then return { ok = false, error = 'invalid_payload' } end
    local ok, result, warnings = ThemeStore.Save(payload.theme, playerName(source), 'save')
    if not ok then return { ok = false, error = result } end
    log(L('theme_saved', playerName(source)))
    return { ok = true, theme = result, warnings = warnings, history = ThemeStore.History() }
end

function handlers.restore(source, payload)
    local ok, result = ThemeStore.Restore(payload.id, playerName(source))
    if not ok then return { ok = false, error = result } end
    log(L('theme_restored', playerName(source)))
    return { ok = true, theme = result, history = ThemeStore.History() }
end

local requestLog = {} -- [source] = { started = ms, count = n }

local function withinRateLimit(source)
    local now = GetGameTimer()
    local entry = requestLog[source]
    if not entry or now - entry.started > RATE_LIMIT.window then
        requestLog[source] = { started = now, count = 1 }
        return true
    end
    entry.count = entry.count + 1
    return entry.count <= RATE_LIMIT.max
end

RegisterNetEvent(EVENT.request, function(requestId, name, payload)
    local source = source
    if type(requestId) ~= 'number' or type(name) ~= 'string' then return end

    local function respond(result)
        TriggerLatentClientEvent(EVENT.response, source, LATENT_BPS, requestId, result)
    end

    local handler = handlers[name]
    if not handler then return respond({ ok = false, error = 'invalid_payload' }) end
    if not withinRateLimit(source) then return respond({ ok = false, error = 'rate_limited' }) end

    -- Re-checked for every single request: having the editor open proves nothing.
    if not Permissions.IsAdmin(source) then
        log(L('rejected_request', playerName(source), getLicense(source) or '?', name))
        return respond({ ok = false, error = 'no_permission' })
    end

    local ok, result = pcall(handler, source, type(payload) == 'table' and payload or {})
    if not ok then
        log(('^1request "%s" failed:^7 %s'):format(name, result))
        return respond({ ok = false, error = 'unknown' })
    end
    respond(result)
end)

---------------------------------------------------------------------------
-- 3. Load-time reports
---------------------------------------------------------------------------

local reported = {}

RegisterNetEvent(EVENT.loaded, function()
    local source = source
    if reported[source] then return end -- one report per session
    reported[source] = true

    local license = getLicense(source)
    local seconds = license and Stats.RecordLoaded(license)
    if seconds and Config.Debug.Verbose then
        log(('%s loaded in %.1fs'):format(playerName(source), seconds))
    end
end)

AddEventHandler('playerDropped', function()
    reported[source] = nil
    requestLog[source] = nil
end)

---------------------------------------------------------------------------
-- Startup
---------------------------------------------------------------------------

-- Load synchronously so the very first connecting player already gets data.
ThemeStore.Load()
Stats.Load()

CreateThread(function()
    -- Give frameworks a moment to start before reporting which bridge is used.
    Wait(2000)
    log(L('started', VERSION, Config.Locale, Permissions.BridgeName()))
end)
