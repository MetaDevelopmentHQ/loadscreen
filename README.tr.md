<div align="center">

<img src="docs/images/tanitim.png" alt="MetaDev Loadscreen" width="100%">

# MetaDev Loadscreen

**Oyuncunun sunucunda gördüğü ilk ekran. Yeniden tasarlandı.**

Oyun içi editörlü ve 26 zamanlanmış özel gün temalı, ücretsiz ve açık kaynak FiveM loading screen.

[![Lisans: MIT](https://img.shields.io/badge/Lisans-MIT-8B5CF6.svg)](LICENSE)
[![FiveM](https://img.shields.io/badge/FiveM-Hazır-22C3E6.svg)](#kurulum)
[![Framework](https://img.shields.io/badge/ESX%20%C2%B7%20QBCore%20%C2%B7%20Qbox%20%C2%B7%20Standalone-destekleniyor-8B5CF6.svg)](#framework-desteği)
[![Discord](https://img.shields.io/badge/Discord-Katıl-5865F2.svg)](https://discord.gg/metav)

[English](README.md) · **Türkçe**

</div>

---

## Özellikler

### Oyun içi editör
`/loadscreen` yaz, editör açılsın. Renk, font, yazılar, müzik ve arka planı canlı önizlemeyle değiştir. **Kaydet** dediğin an bağlanan bir sonraki oyuncu yeni ekranı görür. Restart yok, dosya düzenleme yok.

### Logodan otomatik tema
Logonu yükle. Editör logodaki renkleri çıkarır ve markana uyan 3 tema önerir.

### 26 zamanlanmış tema
Yılbaşında kar yağar, 29 Ekim'de kırmızı-beyaz konfeti, 14 Şubat'ta kalpler, Halloween'de kıvılcımlar. Anma günlerinde ekran siyah-beyaza döner, müzik kendiliğinden kapanır. Türkçe ve İngilizce sunuculara kendi özel günleri gelir. Sen hiçbir şey yapmazsın; tarih gelince tema kendiliğinden değişir.

### Oyuncu için
- Sahte değil, gerçek yükleme ilerlemesi
- Oyuncunun önceki girişlerine göre tahmini kalan süre
- Playlist'li, ses ayarlı müzik oynatıcı
- Kurallar, güncellemeler ve ipuçları kartları
- Klavye kısayolları: `Space` müzik, `←` `→` kartlar, `M` sessiz
- Canlı oyuncu sayısı

### Sunucu sahibi için
- **Tema kodu:** Temanı tek bir kodla paylaş, başkasınınkini saniyede yükle
- **Geri alma:** Son 5 kayıttan birine tek tıkla dön
- **İstatistikler:** Ortalama yükleme süresi ve günlük girişler
- **2 tasarım:** Glass ve Minimal

## Ekran görüntüleri

![Özellikler](docs/images/ozellikler.png)

![Zamanlanmış temalar](docs/images/tanitim2.png)

## Kurulum

1. [Son sürümü](../../releases/latest) indir ve `resources` klasörüne çıkar.
2. Klasör adının `metadev-loadscreen` olduğundan emin ol.
3. `server.cfg` dosyana şu satırı ekle:
   ```cfg
   ensure metadev-loadscreen
   ```
4. Yetkililerine editör iznini ver:
   ```cfg
   add_ace group.admin metadev.loadscreen.admin allow
   ```
5. Sunucuyu yeniden başlat. Bu kadar.

> Aynı anda yalnızca bir loading screen çalışabilir. Varsa diğer loading screen resource'unu kaldır veya durdur.

## Yapılandırma

Her şey oyun içi editörden değiştirilebilir. Sunucu düzeyindeki birkaç ayar için `config.lua` dosyasını aç:

```lua
Config.Locale     = 'tr'                -- 'tr' veya 'en'
Config.Timezone   = 'Europe/Istanbul'   -- zamanlanmış temalar için
Config.Framework  = 'auto'              -- 'auto', 'esx', 'qb', 'qbox', 'standalone'
Config.ShowCredit = true                -- köşedeki küçük MetaDev imzası
```

### Medya
- Görsel, video ve müzikleri `web/media/` klasörüne koy ya da `https://` linkleri kullan.
- Video arka plan için **WebM** kullan. FiveM'in tarayıcısı H.264 MP4'ü her zaman düzgün oynatmayabilir.
- Discord CDN linklerini kullanma; süreleri doluyor.

## Zamanlanmış temalar

Ortak günler iki dilde de çıkar. Dile özel günler yalnızca `Config.Locale`'de o dil seçiliyken çıkar.

| Ortak | Sadece Türkçe | Sadece İngilizce |
|---|---|---|
| Yılbaşı (25–31 Aralık) | 18 Mart Çanakkale Zaferi ve Şehitleri Anma Günü | St. Patrick's Day (17 Mart) |
| Sevgililer Günü (14 Şubat) | 23 Nisan Ulusal Egemenlik ve Çocuk Bayramı | Easter |
| Dünya Kadınlar Günü (8 Mart) | 1 Mayıs Emek ve Dayanışma Günü | Memorial Day |
| 1 Nisan | 19 Mayıs Atatürk'ü Anma, Gençlik ve Spor Bayramı | Independence Day (4 Temmuz) |
| Anneler Günü | 15 Temmuz Demokrasi ve Millî Birlik Günü | Labor Day |
| Babalar Günü | 30 Ağustos Zafer Bayramı | Veterans Day (11 Kasım) |
| 17 Eylül Topluluk Günü | 29 Ekim Cumhuriyet Bayramı | Thanksgiving |
| Halloween (24 Ekim – 1 Kasım) | 10 Kasım Atatürk'ü Anma | Christmas (18–24 Aralık) |
| Black Friday | 24 Kasım Öğretmenler Günü | |

- Her gün editörden kapatılabilir veya mesajı değiştirilebilir.
- Aynı güne iki tema denk gelirse ulusal günler ve anma günleri önceliklidir.
- Tarihi her yıl değişen günler (Easter, Anneler Günü, Thanksgiving…) otomatik hesaplanır.
- Bir temayı o günü beklemeden test etmek için `Config.Debug.ForceDate = '2026-10-29'` yaz.

## Framework desteği

Standalone çalışır. `Config.Framework` değeri `auto` ise ESX, QBCore ve Qbox otomatik algılanır. Framework yalnızca admin yetkisi kontrolü için kullanılır, başka hiçbir şey ona bağlı değildir.

## Sık sorulan sorular

**Gerçekten ücretsiz mi?**
Evet. MIT lisansıyla ücretsiz ve açık kaynak.

**MetaDev imzasını kaldırabilir miyim?**
`Config.ShowCredit = false` ile kapatabilirsin. Bırakırsan seviniriz; ücretsiz kaynak çıkarmaya devam edebilmemizi sağlıyor.

**Düzenledikten sonra restart gerekiyor mu?**
Hayır. Editörde yaptığın değişiklikler bağlanan bir sonraki oyuncuya uygulanır.

**Video arka plan oynamıyor.**
WebM formatına çevir. FiveM'in tarayıcısı H.264 MP4'ü desteklemeyebilir.

## Destek

Sorular, hatalar ve tema paylaşımı için: **[discord.gg/metav](https://discord.gg/metav)**

Hata mı buldun? [Issue aç](../../issues).

## Lisans

[MIT](LICENSE) © MetaDev
