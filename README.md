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
| `admin` | Rapor kuyruğu, ban/mute, rol, kanal yönetimi, cami önerisi onayı, duyuru |
| `worker` | Kuyruk işleyicileri ve zamanlanmış işler |

---

## Hızlı başlangıç (lokal)

```bash
cp .env.example .env                    # JWT_ACCESS_SECRET'ı değiştir
docker compose up -d postgres redis     # PostGIS + Redis
npm ci
npm run db:migrate:dev                  # şemayı kur
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

## Kotalar ve dış servisler

- **YouTube:** `search.list` hiç kullanılmaz (günde 100 çağrı sınırı var). Keşif RSS üzerinden yapılır (kotasız), durum kontrolü `videos.list` ile (50 video = 1 birim). Bitmiş yayınlar bir daha sorgulanmaz.
- **Nominatim / Overpass:** Ücretsiz genel sunucular adil kullanım kurallarına tabidir. `OUTBOUND_USER_AGENT` içine iletişim bilgisi yaz. Trafik büyüyünce kendi Nominatim/Overpass sunucunu kurup URL'leri değiştir.
- **Emushaf:** SLA'sız topluluk servisi. Uzun vadede resmi Diyanet Awqat Salah API'sine geçmek önerilir (sağlayıcı arayüzü hazır).
