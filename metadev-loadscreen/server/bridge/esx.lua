--[[
    ESX bridge: a player is an admin when their ESX group is listed in
    Config.AdminGroups. Used for the editor permission check only.
]]

Bridges = Bridges or {}

local ESX

local function getESX()
    if not ESX then
        local ok, object = pcall(function()
            return exports['es_extended']:getSharedObject()
        end)
        ESX = ok and object or nil
    end
    return ESX
end

Bridges.esx = {
    name = 'esx',

    detect = function()
        return GetResourceState('es_extended') == 'started'
    end,

    isAdmin = function(source)
        local esx = getESX()
        local xPlayer = esx and esx.GetPlayerFromId(source)
        if not xPlayer then return false end

        local group = xPlayer.getGroup and xPlayer.getGroup() or xPlayer.group
        for _, allowed in ipairs(Config.AdminGroups) do
            if group == allowed then return true end
        end
        return false
    end,
}
