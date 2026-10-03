# Yapılandırma (config.lua)

Görsel ayarların neredeyse tamamı oyun içi editörden yapılır ve `data/theme.json` dosyasına yazılır. `config.lua` ise oyun içinden değiştirilmemesi gereken sunucu ayarlarını tutar.

## Genel

| Ayar | Varsayılan | Açıklama |
|---|---|---|
| `Config.Locale` | `'tr'` | Arayüz dili: `'tr'` veya `'en'`. Hangi zamanlanmış temaların görüneceğini de belirler. |
| `Config.Command` | `'loadscreen'` | Editörü açan komut. |

## Yetki

| Ayar | Varsayılan | Açıklama |
|---|---|---|
| `Config.Framework` | `'auto'` | `'auto'`, `'esx'`, `'qb'`, `'qbox'` veya `'standalone'`. Sadece admin kontrolü için kullanılır. |
| `Config.AcePermission` | `'metadev.loadscreen.admin'` | Bu ACE izni olan herkes editörü açabilir. |
| `Config.AdminGroups` | `{ 'admin', 'superadmin', 'god' }` | Editörü açabilen framework grupları. |

Yetki her zaman **sunucuda** kontrol edilir. Editörden gelen her istek (kaydet, içe aktar, geri al) sunucuda yetki ve veri doğrulamasından yeniden geçer.

## Zaman

| Ayar | Varsayılan | Açıklama |
|---|---|---|
| `Config.Timezone` | `'Europe/Istanbul'` | Zamanlanmış temanın hangi güne göre seçileceği (IANA adı). |
| `Config.UtcOffset` | `3` | Aynı saat diliminin UTC farkı. İstatistiklerin gün ayrımında ve yedek olarak kullanılır. |

## İmza

| Ayar | Varsayılan | Açıklama |
|---|---|---|
| `Config.ShowCredit` | `true` | Köşedeki soluk "MADE BY METADEV" yazısı. Açık bırakman rica olunur. |
| `Config.CreditUrl` | Discord linki | İmzaya tıklanınca oyuncunun tarayıcısında açılır. |

## Kapanış

| Ayar | Varsayılan | Açıklama |
|---|---|---|
| `Config.Shutdown.FadeMs` | `800` | Kapanırken kararma süresi (ms). |
| `Config.Shutdown.Events` | `playerSpawned`, `esx:playerLoaded`, `QBCore:Client:OnPlayerLoaded` | "Oyuncu oyunda" anlamına gelen eventler. İlk tetiklenen loading screen'i kapatır. |
| `Config.Shutdown.FallbackSeconds` | `45` | Hiçbir event gelmezse, ağ oturumu başladıktan bu kadar saniye sonra yine de kapatır. `0` kapatır. |

Karakter seçim ekranı kullanıyorsan, o ekranın açıldığı anda tetiklenen event'i listeye ekle (çoğu multicharacter script'i loading screen'i zaten kendisi kapatır).

## İstatistik

| Ayar | Varsayılan | Açıklama |
|---|---|---|
| `Config.Stats.RetentionDays` | `30` | Bu süreden eski günlük veriler tek bir özete toplanır. |
| `Config.Stats.MinLoadSeconds` / `MaxLoadSeconds` | `3` / `1200` | Bu aralığın dışındaki süreler aykırı değer sayılıp atılır. |
| `Config.Stats.SaveInterval` | `60` | İstatistiklerin diske yazılma aralığı (sn). |

## Zamanlanmış temalar

| Ayar | Açıklama |
|---|---|
| `Config.ScheduledThemesEnabled` | Tüm zamanlanmış temaları açar veya kapatır. |
| `Config.ScheduledThemes` | Her gün için `enabled`, `badge`, `message` ve `playlist`. Ayrıntılar: [Zamanlanmış temalar](zamanlanmis-temalar.md). |

## Hata ayıklama

| Ayar | Açıklama |
|---|---|
| `Config.Debug.ForceDate` | `'2026-10-29'` gibi bir tarih verirsen loading screen bugünün o gün olduğunu varsayar. Zamanlanmış temaları test etmek için kullanılır. |
| `Config.Debug.Verbose` | Yükleme sürelerini konsola yazar. |

## Yeni dil ekleme

1. `locales/en.json` dosyasını `locales/de.json` olarak kopyala ve çevir (`meta.intl` alanını `de-DE` yap).
2. `locales/en.lua` dosyasını `locales/de.lua` olarak kopyala ve `Locales['de']` diye çevir.
3. `Config.Locale = 'de'` yap.

Yeni bir dilde ortak özel günler (Yılbaşı, Sevgililer Günü vb.) otomatik görünür. Metinleri `holidays` bölümünde çevir.
