--[[
    Standalone bridge: no framework. Editor access is granted only through the
    ACE permission in Config.AcePermission (checked in server/permissions.lua).
]]

Bridges = Bridges or {}

Bridges.standalone = {
    name = 'standalone',

    detect = function()
        return true
    end,

    isAdmin = function()
        return false
    end,
}
