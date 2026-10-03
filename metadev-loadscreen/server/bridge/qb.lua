--[[
    QBCore bridge: a player is an admin when QBCore grants any permission
    listed in Config.AdminGroups (e.g. 'admin', 'god').
]]

Bridges = Bridges or {}

local QBCore

local function getCore()
    if not QBCore then
        local ok, object = pcall(function()
            return exports['qb-core']:GetCoreObject()
        end)
        QBCore = ok and object or nil
    end
    return QBCore
end

Bridges.qb = {
    name = 'qb',

    detect = function()
        return GetResourceState('qb-core') == 'started'
    end,

    isAdmin = function(source)
        local core = getCore()
        if not core or not core.Functions or not core.Functions.HasPermission then return false end

        for _, group in ipairs(Config.AdminGroups) do
            if core.Functions.HasPermission(source, group) then return true end
        end
        return false
    end,
}
