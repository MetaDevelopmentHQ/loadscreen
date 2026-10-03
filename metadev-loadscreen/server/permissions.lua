--[[
    MetaDev Loadscreen · server/permissions.lua

    Single place that answers "may this player use the editor?".
    1. ACE permission (Config.AcePermission), works everywhere.
    2. Framework admin groups through the active bridge (server/bridge/*.lua).

    All checks run on the server; the client is never trusted.
]]

Permissions = {}

-- Qbox goes first because it also answers to the 'qb-core' resource name.
local DETECT_ORDER = { 'qbox', 'qb', 'esx' }

local activeBridge

---Picks the bridge from Config.Framework. In 'auto' mode we keep looking until
---a framework is found, because frameworks may start after this resource.
local function resolveBridge()
    if activeBridge and activeBridge.name ~= 'standalone' then
        return activeBridge
    end

    local wanted = Config.Framework or 'auto'
    if wanted ~= 'auto' then
        activeBridge = Bridges[wanted] or Bridges.standalone
        return activeBridge
    end

    for _, name in ipairs(DETECT_ORDER) do
        local bridge = Bridges[name]
        if bridge and bridge.detect() then
            activeBridge = bridge
            return activeBridge
        end
    end

    activeBridge = Bridges.standalone
    return activeBridge
end

function Permissions.BridgeName()
    return resolveBridge().name
end

---@param source number
---@return boolean
function Permissions.IsAdmin(source)
    source = tonumber(source)
    if not source or source <= 0 or not GetPlayerName(source) then
        return false
    end

    if IsPlayerAceAllowed(source, Config.AcePermission) then
        return true
    end

    local ok, allowed = pcall(resolveBridge().isAdmin, source)
    return ok and allowed == true
end
