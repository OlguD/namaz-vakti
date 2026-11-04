# Namaz Vakti — Backend

iOS/Android "Namaz Vakti" uygulamasının backend'i. İçerdiği özellikler: namaz ve iftar vakitleri (Diyanet tabloları), konum dizini ve kıble, cami haritası, YouTube canlı yayınları, global sohbet ve moderasyon, kimlik doğrulama, push bildirimleri ve yönetim paneli API'si.

**Stack:** Node 22 · NestJS 12 (ESM) · PostgreSQL 16 + PostGIS · Drizzle ORM · Redis · BullMQ · Socket.IO · Vitest

---

## Mimari

```
                ┌───────────── Traefik ─────────────┐
 mobil uygulama │  HTTPS /v1/*      WSS /chat       │
                └────────┬───────────────┬──────────┘
                         ▼               ▼
                  ┌─────────────────────────────┐        ┌──────────────┐
                  │  api (N replika)            │◄──────►│    Redis     │
                  │  REST + Socket.IO gateway   │ cache, │ BullMQ, rate │
                  └──────────────┬──────────────┘ kilit, │ limit, s.io  │
                                 │                 pubsub └──────▲───────┘
                                 ▼                               │
                  ┌─────────────────────────────┐        ┌──────┴───────┐
                  │  PostgreSQL + PostGIS       │◄───────│ worker       │
                  └─────────────────────────────┘        │ kuyruklar +  │
                                                         │ zamanlanmış  │
   Emushaf · Nominatim · Overpass · YouTube · Expo ◄─────│ işler        │
                                                         └──────────────┘
```

Aynı imaj üç rolde çalışır: `api` (HTTP + WebSocket), `worker` (kuyruk tüketicileri ve zamanlanmış işler), `migrate` (tek seferlik şema güncellemesi). API yatay ölçeklenir. Socket.IO mesajları Redis adapter üzerinden tüm replikalara ulaşır. Zamanlanmış işler BullMQ job scheduler olarak Redis'te tutulur, bu yüzden worker sayısı ne olursa olsun her iş tick başına tek kez çalışır.

### Modüller

| Modül | Ne yapar |
|---|---|
| `prayer-times` + `locations` | Ülke → şehir → ilçe dizini, vakit tabloları, en yakın ilçe, kıble |
| `auth` + `users` | Anonim hesap, Apple/Google/e-posta giriş, JWT + dönen refresh token, hesap silme |
| `mosques` | OpenStreetMap'ten bölge bölge tembel (lazy) cami içe aktarma, yakındaki camiler, kullanıcı önerileri |
| `live` | Seçili YouTube kanallarından canlı/yaklaşan yayın tespiti |
| `chat` | Socket.IO `/chat` namespace'i, odalar, geçmiş, bildir/engelle, filtre, yavaş mod |
| `notifications` | Cihaz kaydı, Expo push yayınları, ölü token temizliği |
| `worship` | Namaz takibi, kaza sayaçları ve hesaplayıcı, zikirmatik senkronu ve istatistikler, İbadet özeti, seri |
| `quran` | Kişisel hatim ilerlemesi, ortak hatim (davet kodu, cüz alma/okundu, turlar) |
| `content` | Dualar, Esmaü'l-Hüsna, dini günler, zekât fiyatları; kullanıcı ayarları senkronu |
| `admin` | Rapor kuyruğu, ban/mute, rol, kanal yönetimi, cami önerisi onayı, duyuru |
| `worker` | Kuyruk işleyicileri ve zamanlanmış işler |

---

## Hızlı başlangıç (lokal)

```bash
cp .env.example .env                    # JWT_ACCESS_SECRET'ı değiştir
docker compose up -d postgres redis     # PostGIS + Redis
npm ci
npm run db:migrate:dev                  # şemayı kur
npm run content:import:dev              # dualar ve esma (dini günleri worker üretir)
npm run start:dev                       # API → http://localhost:3000
npm run start:worker:dev                # ayrı terminalde worker
```

Swagger: `http://localhost:3000/docs` (`SWAGGER_ENABLED=true` iken) · OpenAPI JSON: `/docs/openapi.json`

### Testler

```bash
npm test             # birim testleri (filtre, saat dilimi, kıble, parser'lar…)
npm run test:e2e     # gerçek Postgres + Redis'e karşı uçtan uca; dış servisler sahte
npm run typecheck && npm run lint
```

E2E testleri `vakit_test` veritabanını **sıfırlar**. Adında "test" geçmeyen bir veritabanına karşı çalışmayı reddeder.

### Production (Docker + Traefik)

```bash
cp .env.example .env    # gerçek secret'lar, API_DOMAIN, APPLE/GOOGLE client id'leri…
docker network create traefik   # zaten varsa gerekmez
docker compose up -d --build    # migrate → api ×2 + worker
```

`api` servisi Traefik label'larıyla `${API_DOMAIN}` üzerinde yayınlanır. Sağlık kontrolleri `/health/live` (süreç ayakta mı) ve `/health/ready` (DB + Redis cevap veriyor mu) uçlarındadır.

---

## Web istemcisi (tarayıcı)

Aynı API hem mobil uygulamaya hem tarayıcıdaki web uygulamasına hizmet verir. Tek fark refresh token'ın nerede durduğudur:

| | Mobil | Web |
|---|---|---|
| Access token | Gövdede, Keychain/Keystore'da | Gövdede, **yalnızca bellekte** |
| Refresh token | Gövdede, Keychain/Keystore'da | `nv_rt` çerezinde: `HttpOnly; Secure; SameSite=Strict; Path=/v1/auth`. Gövdede `null` döner |
| İstek başlığı | — | `X-Client-Platform: web` + `credentials: 'include'` |

- **CSRF koruması:** Çerez yalnızca `CORS_ORIGINS` içindeki bir Origin'den ve `X-Client-Platform: web` başlığıyla kabul edilir. Başlık preflight'ı zorunlu kılar; SameSite de ayrıca korur.
- **Sayfa yenilenince:** Web uygulaması açılışta `POST /v1/auth/refresh` çağırır (gövde boş). Çerez geçerliyse yeni access token alır; değilse çerez silinir.
- **Socket.IO:** Tarayıcı bağlantıları da yalnızca izinli origin'lerden kabul edilir.
- **Web push yok:** Expo push tarayıcıyı desteklemiyor. Web'de vakit hatırlatmaları sekme açıkken tarayıcı Notification API'siyle yapılır.

API ile web uygulaması aynı ana alan adındaysa (`app.example.com` + `api.example.com`) `WEB_COOKIE_SAMESITE=strict` kalmalı. Tamamen farklı alan adlarında `none` gerekir, ama bu daha zayıf bir koruma demektir; mümkünse aynı alan adını kullan.

**Oturum iptali:** Hesap silme, ban, rol değişikliği, şifre sıfırlama ve anonim hesabın birleştirilmesi, o kullanıcının **o ana kadar verilmiş access token'larını da anında** geçersiz kılar (Redis'te kısa ömürlü işaret), 15 dakikalık sürelerinin dolması beklenmez.

## İbadet senkronu

Veriler hesaba bağlıdır; telefon ve web aynı veriyi görür. Anonim hesaplarda da çalışır, giriş yapılınca korunur.

- **Gün bilgisi:** "Bugün" kullanıcının saat dilimine göre değiştiği için tarih (`date`/`today`) her zaman istemciden gönderilir. Sunucu yalnızca geçerli bir tarih olup olmadığını ve aralığını kontrol eder.
- **Zikirmatik çevrimdışı çalışır.** Uygulama sayıları biriktirir ve `POST /v1/worship/dhikr-sync` ile **delta** olarak gönderir. Her yükleme bir `batchId` taşır; aynı batch tekrar gelirse uygulanmaz (`applied: false`). Bağlantı koptuğunda aynı `batchId` ile tekrar denemek güvenlidir.
- **Kaza sayaçları** atomik olarak azalır ve sıfırın altına inmez; iki cihaz aynı anda dokunsa da sayı bozulmaz.
- **Seri ("7 gündür"):** Vaktinde kılınan bir namaz, zikir ya da Kur'an okuma olan ardışık günlerdir. Bugün henüz bir şey yapılmadıysa dünkü seri bozulmuş sayılmaz.
- **Ortak hatim:** Aynı cüze aynı anda dokunan iki kişiden yalnızca biri alır, diğeri `409` görür. Üye olmayan biri grubu `404` olarak görür; grup kimlikleri dışarıdan yoklanamaz. Davet kodu döndürülebilir. Sahip ayrılırsa en eski üye sahip olur, son üye ayrılınca grup silinir.
- **Ayarlar** tek bir sürümlü belgedir (`GET/PUT /v1/me/settings`). İki cihaz aynı anda değiştirirse ikincisi `409` ve güncel belgeyi alır, birleştirip tekrar gönderir. Tanınmayan alanlar reddedilir.

## İçerik (dualar, Esmaü'l-Hüsna)

Dualar ve Esmaü'l-Hüsna `content/` klasöründeki JSON dosyalarından yüklenir: `npm run content:import`. Docker'da `migrate` servisi bunu otomatik yapar. Yükleme idempotenttir, tekrar çalıştırmak güvenlidir. Admin uçları (`/v1/admin/content/*`) ile mağaza güncellemesi olmadan düzenlenebilir.

> ⚠️ **Yayından önce:** `duas.json` ve `esma.json` ilk taslaktır (Arapça metinler ve isimler tasarımdan; anlamlar ve kaynaklar taslak). Dini metinlerin ehil biri tarafından kontrol edilmesi şart.

## Dini günler (otomatik)

Kimsenin tarih girmesine gerek yok; worker her gün bu hicri yılın ve gelecek hicri yılın günlerini üretir.

1. **Hicri ay başlangıçları:**
   - Önce **Diyanet'in kendi günlük tablolarından** alınır. Emushaf'tan çekilen her vakit satırında Diyanet'in hicri tarihi de var; "4 Kasım 2026 = 24.5.1448" gibi bir satırdan ayın başlangıcı çıkarılır. Bu kaynak esastır.
   - Tablo henüz o aya ulaşmadıysa **Aladhan API'nin `DIYANET` takvim yöntemi** kullanılır.
   - İki kaynak çakıştığında karşılaştırılır: uyuşuyorlarsa ay `verified` olur, uyuşmuyorlarsa Diyanet kazanır ve fark admin ekranına `conflict` olarak düşer (`GET /v1/admin/content/calendar-status`).
2. **Günler Diyanet kuralıyla hesaplanır:**
   - Kandiller hicri tarihten bir önceki akşam listelenir (ör. Miraç = 27 Recep → 26 Recep akşamı).
   - Regaip, Recep'in ilk Cuma'sından önceki gecedir.
   - Diğerleri: Üç Aylar, Ramazan başlangıcı, Kadir Gecesi, iki bayramın arefesi ve günleri, Hicrî Yılbaşı, Aşure.

   Kurallar Diyanet'in yayımladığı 2025–2027 listeleriyle birebir doğrulandı (`src/calendar/religious-days.spec.ts`).
3. **Admin düzeltmesi:**
   - Tek bir günü elle düzeltmek için `POST /v1/admin/content/religious-days` kullanılır (`hijriYear` ile). Böyle bir kayıt `manual` olarak saklanır ve otomatik üretim onu **asla ezmez**.
   - `DELETE …/religious-days/:key/:hijriYear/override` ile otomatiğe dönülür.
   - `POST …/religious-days/sync` hesaplamayı hemen yeniden çalıştırır.

Aladhan erişilemezse daha önce kaydedilmiş ay başlangıçlarıyla devam edilir; uygulama boş liste görmez.

## Zekât fiyatları (otomatik)

- **Gram fiyatı** = ons fiyatı (USD) ÷ 31,1035 × USD/TRY.
  - Ons fiyatları **GoldAPI.io**'dan gelir (`GOLDAPI_KEY`; ücretsiz planda ayda 500 istek, biz ayda ~90 kullanıyoruz).
  - Kur, **TCMB'nin resmi günlük bülteninden** (döviz satış) alınır.
  - Güncelleme hafta içi 10:23 ve 16:23'te (TR) yapılır.
- **Nisap** varsayılan olarak 80,18 g altındır ve fiyatla birlikte hesaplanır (`nisabAmount`).
- **Güvenlik önlemleri:**
  - Mantıksız fiyatlar ve önceki fiyata göre %25'ten büyük sıçramalar **reddedilir**. Son doğru fiyat yayında kalır, hata admin ekranında görünür (`GET /v1/admin/content/zakat-rates`).
  - Kabul edilen her ölçüm `metal_price_history` tablosunda saklanır.
  - Veri 3 günden eskiyse API `stale: true` döner ve uygulama "güncel olmayabilir" uyarısı gösterir.
- **Admin sabitlemesi:** `PUT /v1/admin/content/zakat-rates` fiyatı sabitler (`source: manual`) ve otomatik güncellemeyi durdurur. `POST …/zakat-rates/auto` otomatiğe döner ve hemen yeniler.
- `GOLDAPI_KEY` yoksa fiyatlar otomatik gelmez ve admin ekranında bu belirtilir.

---

## Vakitler nasıl çalışıyor?

- **Kaynak:** `ezanvakti.emushaf.net` (Diyanet aylık tabloları). Sağlayıcı soyutlanmıştır (`PrayerTimesProvider`). Resmi Diyanet Awqat Salah API'sine geçmek için tek bir sınıf yazıp `prayer-times.module.ts` içindeki bağlamayı değiştirmen yeterli.
- **Saklama:** Vakitler, yayımlandığı gibi yerel `HH:mm` olarak tutulur. Emushaf her satırda Türkiye ofsetini (+03:00) döndürüyor; bu değer **bilinçli olarak yok sayılır**. Gerçek UTC anları, okuma sırasında ilçenin IANA saat dilimiyle hesaplanır (yaz/kış saati dahil).
- **Saat dilimi:** Önce ilçe koordinatından (`geo-tz`), yoksa tek saat dilimli ülkeler için varsayılan değerden (`country-timezones.ts`) alınır.
- **Önbellek:** İlk istekte tablo çekilip DB'ye yazılır, yanıtlar 10 dk Redis'te tutulur. Aynı ilçeye gelen eşzamanlı istekler Redis kilidiyle tek bir dış çağrıya iner. Tablo bitimine 10 günden az kaldığında arka planda yenilenir. Günlük iş, son 14 günde kullanılan ilçeleri tazeler.
- **Kesinti:** Kaynak çökerse eldeki veri `stale: true` ile döner. Hiç veri yoksa ve ilçenin koordinatı biliniyorsa `adhan` ile Diyanet parametrelerine göre yerel hesap yapılır (`source: "calculated"`, İstanbul'da ±1–2 dk).
- **GPS:** `/v1/prayer-times/nearby` 75 km içindeki en yakın ilçenin resmi tablosunu kullanır, yoksa tam koordinat için hesaplar.
- **Koordinatlar:** Emushaf ilçe koordinatı vermiyor. Worker, ilçeleri Nominatim ile saniyede 1 istek limitine uyarak geocode eder. Kullanılan ilçeler kuyrukta öne alınır. Yanlış çıkan konumlar admin uç noktasıyla düzeltilebilir.

**Ramazan:** `days[].isRamadan` Hicri 9. ayı işaretler. İftar = `aksam`, sahur bitişi = `imsak`.

---

## Mobil uygulama entegrasyon notları

**Kimlik akışı**
1. İlk açılışta `POST /v1/auth/anonymous` çağrılır. Token'lar güvenli depoda (Keychain/Keystore) saklanır.
2. Her istekte `Authorization: Bearer <accessToken>` gönderilir. Access token 15 dk geçerlidir; 401 gelirse `POST /v1/auth/refresh` çağrılır. **Refresh token her kullanımda değişir**: yenisini sakla, eskisini at. Eski bir token tekrar kullanılırsa o oturum ailesi tamamen kapatılır (`TOKEN_REUSED`).
3. Sohbete katılmak için Apple/Google/e-posta girişi gerekir. Anonim access token'ı da gönderirsen hesap **yerinde yükseltilir**; ayarlar ve cihazlar korunur.
4. E-posta doğrulama ve şifre sıfırlama linkleri `APP_DEEP_LINK_BASE` (örn. `namazvakti://verify-email?token=…`) ile uygulamayı açar.

**Bildirimler**
- Ezan bildirimleri **cihazda yerel olarak** planlanır; sunucuya gerek yoktur. `days[].instants` UTC ISO değerlerini kullan. iOS'ta en fazla 64 bekleyen yerel bildirim olabilir (5 vakit × ~12 gün), uygulama her açılışta yeniden planlamalı.
- Push (canlı yayın, duyuru) için `PUT /v1/me/devices/:installationId` ile Expo push token'ı ve tercihleri (`liveAlerts`, `announcements`) kaydet.

**Sohbet (Socket.IO)**

```ts
const socket = io(`${API}/chat`, { auth: { token: accessToken }, transports: ['websocket'] });
const { ok, data: history } = await socket.emitWithAck('room:join', { roomId: 'tr' });
const ack = await socket.emitWithAck('message:send', { roomId: 'tr', body: 'Selam', clientMessageId: uuid() });
socket.on('message:new', (m) => …);
socket.on('message:removed', ({ id }) => …);   // silinen / gizlenen mesaj
socket.on('user:removed', ({ userId }) => …);  // banlanan kullanıcının tüm mesajları
```

Bütün olaylar `{ ok: true, data }` ya da `{ ok: false, error: { code, message, details } }` ile cevaplanır. Anonim kullanıcılar okuyabilir ama yazamaz. Engellenen kullanıcıların canlı mesajlarını istemci tarafında `GET /v1/me/blocks` listesine göre süz; geçmiş zaten sunucuda süzülür.

**Mağaza gereksinimleri:** hesap silme `DELETE /v1/me` · içerik bildirme `POST /v1/chat/messages/:id/report` · kullanıcı engelleme `PUT /v1/me/blocks/:userId` · küfür/link filtresi, yavaş mod ve otomatik gizleme (3 bildirim) · moderatör kuyruğu `/v1/admin/reports`.

**Camiler:** Haritada `attribution` metnini (© OpenStreetMap contributors) göstermek zorunludur. Yeni bir bölge ilk kez açıldığında `partial: true` dönebilir; birkaç saniye sonra tekrar iste.

**Canlı yayınlar:** Yalnızca YouTube IFrame oynatıcısı ile oynat (`embedUrl`). Ham stream çıkarmak YouTube kurallarına aykırıdır ve mağaza reddine yol açar.

### Hata biçimi

```json
{ "error": { "code": "SLOW_MODE", "message": "…", "details": { "retryAfterSeconds": 3 } }, "requestId": "…" }
```

Uygulama `code` alanına göre davranmalı, `message` değişebilir. Kodların tamamı `src/common/errors.ts` içinde.

---

## Yönetim

- İlk admin: `ADMIN_EMAILS` içindeki doğrulanmış e-posta ile giriş yapan hesap otomatik admin olur. Diğer moderatörleri `PUT /v1/admin/users/:id/role` ile ata.
- Canlı yayın kanalı ekleme: `POST /v1/admin/live/channels` → `{ "channel": "@kanal" | "UC…" | URL, "category": "haramain|dua|quran|sohbet|other", "notifyOnLive": true }`. 7/24 yayınlar için `POST /v1/admin/live/channels/:id/pin` ile video sabitlenebilir.
- Konum dizinini elle yenileme: `POST /v1/admin/sync/locations`.
- Duyuru gönderme: `POST /v1/admin/notifications/broadcast`.

## Zamanlanmış işler (UTC)

| İş | Ne zaman | Ne yapar |
|---|---|---|
| `weekly-location-sync` | Pazar 02:13 | Ülke/şehir/ilçe dizinini tazeler |
| `hourly-geocode-backlog` | Saat başı :07 | Koordinatı eksik ilçeleri kuyruğa alır |
| `daily-prayer-refresh` | Her gün 01:23 | Aktif ilçelerin tablolarını uzatır, eski günleri siler |
| `live-poll` | `LIVE_POLL_CRON` (2 dk) | Kanalların canlı durumunu günceller |
| `push-receipts` | 15 dk'da bir | Silinen uygulamaların push token'larını temizler |
| `prune-sync-batches` | Her gün 03:37 | 30 günden eski zikir senkron anahtarlarını siler |
| `sync-religious-days` | Her gün 04:17 (+ her açılışta) | Hicri ay başlangıçlarını ve dini günleri günceller |
| `refresh-metal-prices` | Hafta içi 07:23 ve 13:23 (+ her açılışta) | Altın/gümüş gram fiyatını ve nisabı günceller |

## Kotalar ve dış servisler

- **YouTube:** `search.list` hiç kullanılmaz (günde 100 çağrı sınırı var). Keşif RSS üzerinden yapılır (kotasız), durum kontrolü `videos.list` ile (50 video = 1 birim). Bitmiş yayınlar bir daha sorgulanmaz.
- **Nominatim / Overpass:** Ücretsiz genel sunucular adil kullanım kurallarına tabidir. `OUTBOUND_USER_AGENT` içine iletişim bilgisi yaz. Trafik büyüyünce kendi Nominatim/Overpass sunucunu kurup URL'leri değiştir.
- **Aladhan / TCMB:** Ücretsiz ve anahtarsız. Erişilemedikleri sürece son bilinen veri kullanılır.
- **GoldAPI.io:** Ücretsiz plan ayda 500 istek. Anahtar yalnızca sunucudaki `.env` dosyasında durur, repoya girmez.
- **Emushaf:** SLA'sız topluluk servisi. Uzun vadede resmi Diyanet Awqat Salah API'sine geçmek önerilir (sağlayıcı arayüzü hazır).
