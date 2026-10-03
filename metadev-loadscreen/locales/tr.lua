-- Lua-side Turkish strings. Interface texts are in locales/tr.json.
Locales = Locales or {}

Locales['tr'] = {
    started              = 'v%s başlatıldı · dil: %s · yetki köprüsü: %s',
    editor_no_permission = 'Loading screen editörünü açmak için yetkin yok.',
    editor_console       = 'Editör oyun içinden açılır: /%s',
    editor_suggestion    = 'Loading screen tema editörünü açar',
    theme_saved          = '%s temayı kaydetti.',
    theme_restored       = '%s temayı geçmişteki bir kayda döndürdü.',
    theme_invalid_file   = 'data/theme.json okunamadı, varsayılan tema kullanılıyor.',
    write_failed         = '%s dosyasına yazılamadı. Klasörün yazma iznini kontrol et.',
    rejected_request     = '%s (%s) yetkisiz bir editör isteği gönderdi: %s',
    unknown_player       = 'Bilinmeyen oyuncu',
}
