# Tema editörü

Oyunda `/loadscreen` yaz. Yetkin yoksa sohbete bir uyarı düşer.

Editörün üç bölümü var:

- **Sol panel:** ayarlar (sekmeler üstte).
- **Orta:** 1920×1080 canlı önizleme. Gerçek loading screen ile aynı kodla çizilir, yani gördüğün şey oyuncunun göreceği şeyle birebir aynıdır.
- **Alt:** seçimlerinin özeti ve önizleme tarihindeki zamanlanmış tema.

Değişiklikler önce bir taslakta tutulur. **Kaydet** dediğinde sunucu taslağı doğrular, `data/theme.json` dosyasına yazar ve bir sonraki bağlantıdan itibaren uygular. Restart gerekmez. **Sıfırla** kaydedilmemiş değişiklikleri geri alır. `Esc` ile kapanır; kaydedilmemiş değişiklik varsa önce onay sorar.

## Sekmeler

### Tasarım
- **Tasarım galerisi:** Glass veya Minimal. Bir hazır tema tasarımı, vurgu rengini ve fontu birlikte uygular (metinlere dokunmaz).
- **Vurgu rengi:** 6 hazır renk veya serbest renk (`#RRGGBB`).
- **Başlık fontu:** Syne, Manrope veya Instrument Serif.
- **Modüller:** Kişisel karşılama, müzik, kartlar, oyuncu sayısı, tahmini süre.

### İçerik
Sunucu adı (büyük başlık), tam ad (sol üst), rozet satırı, slogan ve kartlar (Kurallar, Güncellemeler, İpuçları; her biri en fazla 8 öğe). Glass her sekmede ilk 4 öğeyi gösterir. Minimal hepsini sırayla döndürür.

### Medya
- **Arka plan:** `media/…` veya `https://…`. Tür otomatik algılanır (`.webm` → video). Video için WebM kullan.
- **Logo:** Boş bırakılırsa tam adın baş harfleri gösterilir.
- **Logodan renk öner:** Logodaki baskın renkleri çıkarır ve koyu zeminde okunabilir 3 renk önerir. İlki önerilen renktir; tıklayınca uygulanır. Uzak görseller için sunucunun CORS izni vermesi gerekir. Vermiyorsa logoyu `web/media/logo/` içine koy.
- **Müzik:** Varsayılan ses, karışık çalma ve playlist (en fazla 25 şarkı). Playlist boşsa müzik kartı gizlenir.

### Takvim
Zamanlanmış temaları listeler. Her günü açıp kapatabilir, rozetini ve mesajını değiştirebilirsin. **Önizleme tarihi** ile herhangi bir günün temasını önizlemede görebilirsin. Bu tarih sadece önizlemeyi etkiler, kaydedilmez.

### Paylaş
- **Kodu kopyala:** Temanı `MDLS1:` ile başlayan bir koda çevirir. Medya dosyaları koda dahil edilmez, sadece `https://` bağlantıları eklenir.
- **Kod ile içe aktar:** Kodu yapıştır. Kod önce sunucuda doğrulanır, sonra taslağa uygulanır. Kodda olmayan alanlar (ör. yerel arka plan) senin mevcut değerlerinde kalır. Uygulamak için **Kaydet**'e bas.

### Geçmiş
Son 5 kayıt zaman damgası ve kaydeden kişiyle listelenir. **Geri dön** o kaydı yeniden uygular. Bu işlem de yeni bir kayıt sayılır.

### İstatistik
Ortalama, en hızlı ve en yavaş yükleme süresi, bugünkü giriş sayısı ve son 7 günün grafiği. 30 günden eski günlük veriler tek bir özete toplanır.

## Güvenlik

- Editörü açmak, kaydetmek, içe aktarmak ve geri almak sunucuda her seferinde yeniden yetki kontrolünden geçer.
- Sunucu gelen temayı alan alan yeniden kurar: bilinmeyen alanları atar, renklerin hex olduğunu, metin uzunluklarını ve URL'lerin `https://` ya da `media/` olduğunu kontrol eder.
- İstekler oyuncu başına hız sınırına tabidir.
