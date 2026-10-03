-- Lua-side English strings. Interface texts are in locales/en.json.
Locales = Locales or {}

Locales['en'] = {
    started              = 'v%s started · locale: %s · permission bridge: %s',
    editor_no_permission = 'You do not have permission to open the loading screen editor.',
    editor_console       = 'The editor is opened in-game: /%s',
    editor_suggestion    = 'Opens the loading screen theme editor',
    theme_saved          = '%s saved the theme.',
    theme_restored       = '%s restored a theme from history.',
    theme_invalid_file   = 'Could not read data/theme.json, using the default theme.',
    write_failed         = 'Could not write %s. Check the folder\'s write permission.',
    rejected_request     = '%s (%s) sent an unauthorized editor request: %s',
    unknown_player       = 'Unknown player',
}
