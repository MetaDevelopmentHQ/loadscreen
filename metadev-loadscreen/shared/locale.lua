--[[
    MetaDev Loadscreen · shared/locale.lua

    Lua-side translations (console and chat messages). Interface texts live in
    locales/<code>.json and are loaded by the web pages.

    Usage:  L('editor_no_permission')  or  L('history_restored', name)
]]

Locales = Locales or {}

local function activeTable()
    return Locales[Config.Locale] or Locales['en'] or {}
end

---Returns a translated string, formatted with string.format when args are given.
---@param key string
---@return string
function L(key, ...)
    local text = activeTable()[key] or (Locales['en'] and Locales['en'][key]) or key
    if select('#', ...) > 0 then
        return text:format(...)
    end
    return text
end
