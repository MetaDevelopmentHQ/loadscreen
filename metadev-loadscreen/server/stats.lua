--[[
    MetaDev Loadscreen · server/stats.lua

    Measures how long players take to load (from `playerConnecting` until the
    client reports a full spawn) and keeps:

      days     per-day totals for the last Config.Stats.RetentionDays days
      archive  one rolled-up summary of everything older than that
      players  each player's last load time, keyed by a hash of their license

    Raw identifiers are never written to disk: players are stored under the
    32-bit Jenkins hash (GetHashKey) of their license, which is plenty to
    tell players apart for an estimate and cannot be turned back into a license.
]]

Stats = {}

local RESOURCE = GetCurrentResourceName()
local STATS_FILE = 'data/stats.json'
local PLAYER_RETENTION_DAYS = 180

local data
local dirty = false
local pending = {} -- [playerKey] = GetGameTimer() at playerConnecting

---------------------------------------------------------------------------
-- Helpers
---------------------------------------------------------------------------

local function emptyData()
    return { days = {}, archive = { count = 0, total = 0 }, players = {} }
end

---Calendar day in the server's timezone (Config.UtcOffset), e.g. "2026-10-29".
local function dayKey(epoch)
    return os.date('!%Y-%m-%d', (epoch or os.time()) + math.floor(Config.UtcOffset * 3600))
end

local function playerKey(license)
    return tostring(GetHashKey(license))
end

local function round(value, decimals)
    local factor = 10 ^ (decimals or 0)
    return math.floor(value * factor + 0.5) / factor
end

local function addSample(bucket, seconds)
    bucket.count = (bucket.count or 0) + 1
    bucket.total = round((bucket.total or 0) + seconds, 1)
    bucket.min = bucket.min and math.min(bucket.min, seconds) or seconds
    bucket.max = bucket.max and math.max(bucket.max, seconds) or seconds
end

local function mergeBucket(into, from)
    if not from or (from.count or 0) == 0 then return end
    into.count = (into.count or 0) + from.count
    into.total = round((into.total or 0) + (from.total or 0), 1)
    if from.min then into.min = into.min and math.min(into.min, from.min) or from.min end
    if from.max then into.max = into.max and math.max(into.max, from.max) or from.max end
end

---Folds old days into the archive and forgets players not seen for a long time.
local function rollUp()
    local cutoff = dayKey(os.time() - Config.Stats.RetentionDays * 86400)
    for day, bucket in pairs(data.days) do
        if day < cutoff then
            mergeBucket(data.archive, bucket)
            data.days[day] = nil
            dirty = true
        end
    end

    local playerCutoff = os.time() - PLAYER_RETENTION_DAYS * 86400
    for key, player in pairs(data.players) do
        if (player.at or 0) < playerCutoff then
            data.players[key] = nil
            dirty = true
        end
    end
end

local function save()
    if not dirty then return end
    local ok, encoded = pcall(json.encode, data)
    if ok and SaveResourceFile(RESOURCE, STATS_FILE, encoded, -1) then
        dirty = false
    end
end

---------------------------------------------------------------------------
-- Public API
---------------------------------------------------------------------------

function Stats.Load()
    local raw = LoadResourceFile(RESOURCE, STATS_FILE)
    local ok, decoded = pcall(json.decode, raw or '')
    data = (ok and type(decoded) == 'table') and decoded or emptyData()
    -- json.decode turns empty objects into arrays; normalise the shape.
    data.days = type(data.days) == 'table' and data.days or {}
    data.archive = type(data.archive) == 'table' and data.archive or { count = 0, total = 0 }
    data.players = type(data.players) == 'table' and data.players or {}
    rollUp()
end

---Remembers when a player started connecting.
function Stats.MarkConnecting(license)
    pending[playerKey(license)] = GetGameTimer()
end

---Records a finished load. Returns the duration in seconds, or nil if ignored.
function Stats.RecordLoaded(license)
    local key = playerKey(license)
    local started = pending[key]
    if not started then return nil end
    pending[key] = nil

    local seconds = round((GetGameTimer() - started) / 1000, 1)
    if seconds < Config.Stats.MinLoadSeconds or seconds > Config.Stats.MaxLoadSeconds then
        return nil
    end

    local today = dayKey()
    data.days[today] = data.days[today] or { count = 0, total = 0 }
    addSample(data.days[today], seconds)
    data.players[key] = { last = seconds, at = os.time() }
    dirty = true
    return seconds
end

---Average load time over the retained days (falls back to the archive).
function Stats.Average()
    local bucket = { count = 0, total = 0 }
    for _, day in pairs(data.days) do mergeBucket(bucket, day) end
    if bucket.count == 0 then mergeBucket(bucket, data.archive) end
    if bucket.count == 0 then return nil end
    return round(bucket.total / bucket.count, 1)
end

---What the loading screen should expect: this player's last time, else the average.
---@return table|nil { seconds = number, source = 'personal'|'average' }
function Stats.EstimateFor(license)
    local player = license and data.players[playerKey(license)]
    if player and player.last then
        return { seconds = player.last, source = 'personal' }
    end
    local average = Stats.Average()
    return average and { seconds = average, source = 'average' } or nil
end

---Epoch seconds of the player's previous completed load, or nil.
function Stats.LastSeen(license)
    local player = license and data.players[playerKey(license)]
    return player and player.at or nil
end

---Numbers for the editor's statistics tab.
function Stats.Summary()
    local all = { count = 0, total = 0 }
    for _, day in pairs(data.days) do mergeBucket(all, day) end
    mergeBucket(all, data.archive)

    local week = {}
    for offset = 6, 0, -1 do
        local key = dayKey(os.time() - offset * 86400)
        local bucket = data.days[key]
        week[#week + 1] = { date = key, count = bucket and bucket.count or 0 }
    end

    return {
        total = all.count,
        average = all.count > 0 and round(all.total / all.count, 1) or nil,
        fastest = all.min,
        slowest = all.max,
        today = week[#week].count,
        week = week,
    }
end

---------------------------------------------------------------------------
-- Housekeeping
---------------------------------------------------------------------------

CreateThread(function()
    while true do
        Wait(Config.Stats.SaveInterval * 1000)

        -- Players who dropped mid-load never report back; forget them.
        local now = GetGameTimer()
        for key, started in pairs(pending) do
            if now - started > Config.Stats.MaxLoadSeconds * 1000 then pending[key] = nil end
        end

        rollUp()
        save()
    end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource == RESOURCE then save() end
end)
