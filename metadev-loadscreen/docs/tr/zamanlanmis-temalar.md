# Zamanlanmış temalar

Belirli günlerde loading screen kendiliğinden özel bir görünüme geçer. Zamanlanmış tema senin temanın **üstüne** uygulanır: sadece vurgu rengi, renk tonu, efekt, rozet, mesaj ve gerekirse müzik değişir. Tasarım, logo ve sunucu adı aynı kalır.

## Dil kuralı

- **Ortak** günler her dilde çıkar; metinler seçili dilde gösterilir.
- **TR** günler sadece `Config.Locale = 'tr'` iken çıkar.
- **EN** günler sadece `Config.Locale = 'en'` iken çıkar.

## Öncelik

Aynı güne iki tema denk gelirse `priority` değeri yüksek olan kazanır. Ulusal günler ve anma günleri (80–100) kutlamalardan (20–60) önce gelir. Örneğin TR'de 28–30 Ekim'de Halloween yerine Cumhuriyet Bayramı görünür.

## Günler

| Gün | Tarih | Kapsam | Efekt |
|---|---|---|---|
| Yılbaşı | 25–31 Aralık | Ortak | kar, yeni yıla geri sayım |
| Sevgililer Günü | 14 Şubat | Ortak | kalpler |
| Dünya Kadınlar Günü | 8 Mart | Ortak | mor konfeti |
| 1 Nisan | 1 Nisan | Ortak | renkli konfeti, sunucu adı −4° eğik |
| Anneler Günü | Mayıs'ın 2. pazarı | Ortak | kalpler |
| Babalar Günü | Haziran'ın 3. pazarı | Ortak | yok |
| 17 Eylül Topluluk Günü | 17 Eylül | Ortak | yeşil-beyaz-altın konfeti |
| Halloween | 24 Ekim – 1 Kasım | Ortak | kıvılcımlar |
| Black Friday | Thanksgiving'den sonraki cuma | Ortak | yok |
| Çanakkale Zaferi | 18 Mart | TR | anma |
| 23 Nisan | 23 Nisan | TR | renkli konfeti |
| 1 Mayıs | 1 Mayıs | TR | kırmızı ton |
| 19 Mayıs | 19 Mayıs | TR | kırmızı ton |
| 15 Temmuz | 15 Temmuz | TR | anma |
| 30 Ağustos | 30 Ağustos | TR | koyu kırmızı ton |
| Cumhuriyet Bayramı | 28–30 Ekim | TR | kırmızı-beyaz konfeti |
| 10 Kasım | 10 Kasım | TR | anma, %100 siyah-beyaz |
| Öğretmenler Günü | 24 Kasım | TR | hafif konfeti |
| St. Patrick's Day | 17 Mart | EN | yeşil konfeti, yonca |
| Easter | Paskalya pazarı (Computus) | EN | pastel konfeti |
| Memorial Day | Mayıs'ın son pazartesi | EN | anma |
| Independence Day | 4 Temmuz | EN | kırmızı-beyaz-mavi konfeti |
| Labor Day | Eylül'ün 1. pazartesi | EN | ABD bayrağı |
| Veterans Day | 11 Kasım | EN | anma |
| Thanksgiving | Kasım'ın 4. perşembesi | EN | yapraklar |
| Christmas | 18–24 Aralık | EN | kar |

## Anma teması

Anma günlerinde (`mode: 'remembrance'`) fotoğraf %75 gri tonlamalı olur (10 Kasım'da %100), efekt yoktur, müzik kapanır ve müzik kartının yerinde "Saygı nedeniyle bugün müzik kapalıdır." yazar.

## Dinamik değişkenler

Mesajlarda şu değişkenleri kullanabilirsin:

| Değişken | Anlamı |
|---|---|
| `{years}` | Yıl dönümü sayısı. Cumhuriyet: yıl − 1923, 10 Kasım: yıl − 1938, Topluluk Günü (GTA V): yıl − 2013 … |
| `{days}` | 1 Ocak'a kalan gün |
| `{year}` / `{nextYear}` | Bu yıl / gelecek yıl |

## Özelleştirme

**config.lua** ile:

```lua
Config.ScheduledThemes['halloween'] = { enabled = false }
Config.ScheduledThemes['republic-day'] = {
    enabled = true,
    message = 'Cumhuriyetimizin {years}. yılı kutlu olsun! Bu akşam meydanda konser var.',
    playlist = { { title = 'Onuncu Yıl Marşı', artist = '', src = 'media/music/onuncu-yil.mp3' } },
}
```

**Editör** ile: *Takvim* sekmesinde günü aç/kapat veya rozet ve mesajını değiştir. Editörden yapılan değişiklikler `config.lua`'nın üstüne yazılır.

Tamamen kapatmak için: `Config.ScheduledThemesEnabled = false`.

## Test etme

```lua
Config.Debug = { ForceDate = '2026-10-29' }
```

Resource'u yeniden başlatıp sunucuya bağlan. Loading screen 29 Ekim temasıyla açılır. Editördeki *Takvim → Önizleme tarihi* alanı da restart gerektirmeden önizleme yapar.

Tarayıcıda test (FiveM olmadan): `python -m http.server` ile resource klasörünü yayınla ve
`http://localhost:8000/web/loadscreen.html?date=2026-11-10&layout=minimal` adresini aç.

Takvim mantığının testleri: `node web/js/calendar.test.mjs`
