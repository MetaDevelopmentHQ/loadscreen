# Sık sorulan sorular

**Loading screen hiç kapanmıyor.**
Spawn script'in `Config.Shutdown.Events` listesindeki eventlerden hiçbirini tetiklemiyor olabilir. Kendi spawn event'ini listeye ekle. Hiçbir şey yapmasan da `FallbackSeconds` (varsayılan 45 sn) sonunda kapanır.

**Karakter seçim ekranı loading screen'in arkasında kalıyor.**
Multicharacter script'inin açılış event'ini `Config.Shutdown.Events` listesine ekle. Ya da script'in kendisi `ShutdownLoadingScreenNui()` çağırıyorsa bir şey yapmana gerek yok.

**Müzik çalmıyor.**
Playlist boşsa müzik kartı gizlenir. Editör → Medya'dan şarkı ekle. Yerel dosya eklediysen resource'u yeniden başlat. Bağlantı `https://` olmalı ve Discord CDN olmamalı.

**Video arka plan siyah kalıyor.**
WebM kullan. FiveM'in tarayıcısı H.264 MP4'ü güvenilir şekilde oynatamayabilir.

**Arka planım birkaç gün sonra kayboldu.**
Muhtemelen Discord CDN linki kullandın. Bu linkler süreli. Dosyayı `web/media/` içine koy.

**Kaydettim ama değişmedi.**
Değişiklik bir sonraki bağlantıda uygulanır; o anda yükleme ekranında olan oyuncular eski temayı görür. Konsolda "yazılamadı" uyarısı varsa `data/` klasörüne yazma izni ver.

**`/loadscreen` "yetkin yok" diyor.**
`add_ace group.admin metadev.loadscreen.admin allow` satırını ekle ve kendini o gruba ekle, ya da framework grubunu `Config.AdminGroups` içine yaz.

**Tahmini süre görünmüyor.**
Henüz hiçbir yükleme kaydedilmemiştir. İlk oyuncu tamamen spawn olduktan sonra ortalama oluşur. Editörde "Tahmini süre" modülünün açık olduğundan emin ol.

**Logodan renk çıkarma "CORS" hatası veriyor.**
Uzak sunucu, görselinin okunmasına izin vermiyor. Logoyu `web/media/logo/` içine koy ve yerel yolla kullan.

**Efektler görünmüyor.**
Oyuncunun sisteminde "animasyonları azalt" ayarı açıksa efektler bilerek kapatılır (`prefers-reduced-motion`). Ayrıca anma günlerinde efekt yoktur.

**"MADE BY METADEV" yazısını kaldırabilir miyim?**
Evet, `Config.ShowCredit = false`. Ama açık bırakırsan bu ücretsiz projeye çok destek olursun.

**Framework şart mı?**
Hayır. Framework sadece admin grubu kontrolü için kullanılır. Standalone'da ACE izni yeterlidir.
