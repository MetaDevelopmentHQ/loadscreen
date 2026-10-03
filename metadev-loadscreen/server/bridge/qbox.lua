--[[
    Qbox bridge: Qbox manages groups through ACE ("group.admin"). We ask
    qbx_core first and fall back to the ACE group check.
]]

Bridges = Bridges or {}

Bridges.qbox = {
    name = 'qbox',

    detect = function()
        return GetResourceState('qbx_core') == 'started'
    end,

    isAdmin = function(source)
        for _, group in ipairs(Config.AdminGroups) do
            local ok, allowed = pcall(function()
                return exports.qbx_core:HasPermission(source, group)
            end)
            if ok and allowed then return true end
            if IsPlayerAceAllowed(source, ('group.%s'):format(group)) then return true end
        end
        return false
    end,
}
