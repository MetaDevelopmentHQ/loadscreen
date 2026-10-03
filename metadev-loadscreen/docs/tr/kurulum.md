# Kurulum

## Gereksinimler

- Güncel bir FXServer (cerulean, Lua 5.4).
- Framework gerekmez. ESX, QBCore veya Qbox varsa admin yetkisi için otomatik kullanılır.
- Node.js veya build adımı gerekmez.

## Adımlar

1. Klasörü `resources/metadev-loadscreen` olarak kopyala. Klasör adı önemli: editör NUI çağrıları bu adı kullanır.
2. `server.cfg` dosyasına ekle:
   ```cfg
   ensure metadev-loadscreen
   ```
3. Editöre kimin girebileceğini belirle (birini seç):
   ```cfg
   # ACE grubu ile
   add_ace group.admin metadev.loadscreen.admin allow
   add_principal identifier.license:XXXXXXXX group.admin

   # veya framework grubu ile: config.lua → Config.AdminGroups
   ```
4. Başka bir loading screen resource'u varsa kaldır. Aynı anda yalnızca bir `loadscreen` çalışır.
5. `data/` klasörünün FXServer tarafından yazılabilir olduğundan emin ol (tema, geçmiş ve istatistikler buraya yazılır).

## İlk çalıştırma

- Sunucu konsolunda şuna benzer bir satır görürsün:
  `[metadev-loadscreen] v1.0.0 başlatıldı · dil: tr · yetki köprüsü: standalone`
- Oyuna gir, `/loadscreen` yaz, editör açılır. İlk kayıtta `data/theme.json` oluşur.

## Güncelleme

`data/` klasörünü sakla ve diğer dosyaları yenileriyle değiştir. Temaların, geçmiş ve istatistikler korunur.

## Kendi medyanı ekleme

1. Dosyayı `web/media/` (arka plan), `web/media/logo/` veya `web/media/music/` içine koy.
2. Resource'u yeniden başlat (`ensure metadev-loadscreen` veya sunucu restart'ı). FiveM dosyaları başlatma anında paketler.
3. Editörde yolu `media/arka-plan.webp` biçiminde gir.

Uzak dosyalar için kalıcı bir `https://` adresi kullan. **Discord CDN linkleri süreli olduğu için çalışmayı bırakır.** Video için **WebM** kullan; FiveM'in tarayıcısı H.264 MP4'ü güvenilir oynatamayabilir.
