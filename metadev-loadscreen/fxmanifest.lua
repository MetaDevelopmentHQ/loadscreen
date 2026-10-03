fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'metadev-loadscreen'
author 'MetaDev'
description 'Free, open-source loading screen with an in-game theme editor and scheduled holiday themes.'
version '1.0.0'

-- Loading screen (keyboard + mouse enabled, closed by client/main.lua after spawn)
loadscreen 'web/loadscreen.html'
loadscreen_manual_shutdown 'yes'
loadscreen_cursor 'yes'

-- In-game theme editor
ui_page 'web/editor.html'

shared_scripts {
    'config.lua',
    'locales/*.lua',
    'shared/locale.lua',
}

server_scripts {
    'server/bridge/*.lua',
    'server/permissions.lua',
    'server/theme_store.lua',
    'server/stats.lua',
    'server/main.lua',
}

client_scripts {
    'client/main.lua',
    'client/editor.lua',
}

files {
    'web/loadscreen.html',
    'web/editor.html',
    'web/css/*.css',
    'web/js/*.js',
    'web/js/vendor/*.js',
    'web/fonts/*.woff2',
    'web/media/**/*',
    'locales/*.json',
}
