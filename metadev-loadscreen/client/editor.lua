--[[
    MetaDev Loadscreen · client/editor.lua

    Bridges the editor page (web/editor.html) and the server. The client
    decides nothing: it forwards requests and returns the server's answers.
    Permission checks and validation happen in server/main.lua.
]]

local REQUEST_EVENT = 'metadev-loadscreen:server:request'
local REQUEST_TIMEOUT = 10000
local LATENT_BPS = 200000

local pending = {}
local nextRequestId = 0
local isOpen = false

---Sends a request to the server and waits for the response.
---@return table result { ok = boolean, error = string|nil, ... }
local function serverRequest(name, payload)
    nextRequestId = nextRequestId + 1
    local id = nextRequestId
    local p = promise.new()
    pending[id] = p

    TriggerLatentServerEvent(REQUEST_EVENT, LATENT_BPS, id, name, payload or {})

    SetTimeout(REQUEST_TIMEOUT, function()
        if pending[id] then
            pending[id] = nil
            p:resolve({ ok = false, error = 'timeout' })
        end
    end)

    return Citizen.Await(p)
end

RegisterNetEvent('metadev-loadscreen:client:response', function(id, result)
    local p = pending[id]
    if p then
        pending[id] = nil
        p:resolve(type(result) == 'table' and result or { ok = false, error = 'unknown' })
    end
end)

---------------------------------------------------------------------------
-- Opening / closing
---------------------------------------------------------------------------

RegisterNetEvent('metadev-loadscreen:client:openEditor', function(payload)
    isOpen = true
    SetNuiFocus(true, true)
    SendNUIMessage({ action = 'open', payload = payload })
end)

local function closeEditor()
    isOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
end

RegisterNUICallback('close', function(_, cb)
    closeEditor()
    cb({ ok = true })
end)

AddEventHandler('onResourceStop', function(resource)
    if resource == GetCurrentResourceName() and isOpen then
        SetNuiFocus(false, false)
    end
end)

---------------------------------------------------------------------------
-- Requests forwarded to the server
---------------------------------------------------------------------------

for _, name in ipairs({ 'save', 'validate', 'restore', 'refresh' }) do
    RegisterNUICallback(name, function(data, cb)
        CreateThread(function()
            cb(serverRequest(name, type(data) == 'table' and data or {}))
        end)
    end)
end

---------------------------------------------------------------------------
-- Chat suggestion
---------------------------------------------------------------------------

CreateThread(function()
    TriggerEvent('chat:addSuggestion', '/' .. Config.Command, L('editor_suggestion'))
end)
