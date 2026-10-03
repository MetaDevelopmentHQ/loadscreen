--[[
    MetaDev Loadscreen · client/main.lua

    Closes the loading screen once the player has really spawned:
      1. tell the page to finish (100 %, fade out, music fade)
      2. wait for the fade, then ShutdownLoadingScreenNui()
      3. report the load as finished so the server can time it
]]

local closed = false

local function closeLoadingScreen()
    if closed then return end
    closed = true

    local fadeMs = Config.Shutdown.FadeMs or 800
    SendLoadingScreenMessage(json.encode({ eventName = 'metadev:shutdown', fadeMs = fadeMs }))
    Wait(fadeMs)

    ShutdownLoadingScreen()
    ShutdownLoadingScreenNui()
    TriggerServerEvent('metadev-loadscreen:server:loaded')
end

-- Spawn events: 'playerSpawned' (spawnmanager) and framework "loaded" events.
for _, eventName in ipairs(Config.Shutdown.Events or {}) do
    RegisterNetEvent(eventName, function()
        CreateThread(closeLoadingScreen)
    end)
end

-- Safety net for spawn scripts that fire none of the events above.
CreateThread(function()
    local fallback = tonumber(Config.Shutdown.FallbackSeconds) or 0
    if fallback <= 0 then return end

    while not NetworkIsPlayerActive(PlayerId()) do
        Wait(250)
    end

    local deadline = GetGameTimer() + fallback * 1000
    while not closed and GetGameTimer() < deadline do
        Wait(500)
    end
    closeLoadingScreen()
end)
