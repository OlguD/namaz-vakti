# Vakit — mobil ve web istemcisi

iOS, Android ve tarayıcı için tek kod tabanı: **Expo SDK 58**, **Expo Router**, TypeScript.
Backend bu reponun kökündeki NestJS projesidir.

## Hızlı başlangıç

```bash
cd client
cp .env.example .env          # EXPO_PUBLIC_API_URL'yi backend adresine ayarlayın
npm install
npm run web                   # tarayıcıda (http://localhost:8081)
npx expo run:ios              # iOS geliştirme derlemesi (Xcode gerekir)
npx expo run:android          # Android geliştirme derlemesi
```

Tarayıcıdan çalışırken web adresinin backend'in `CORS_ORIGINS` listesinde olması gerekir
(ör. `CORS_ORIGINS=http://localhost:8081`). Yerelde HTTPS yoksa backend'de `WEB_COOKIE_SECURE=false`.

İnternetsiz geliştirme için backend'i sahte dış servislerle çalıştırabilirsiniz
(kökteki README → "Sahte dış servisler").

> Uygulama yerel modüller (harita, Apple girişi, bildirimler, pusula) kullandığı için
> **Expo Go ile değil, geliştirme derlemesiyle** çalışır.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run web` / `ios` / `android` | Geliştirme sunucusu |
| `npm run typecheck` | TypeScript kontrolü |
| `npm run lint` | ESLint |
| `npm test` | Birim testleri (jest-expo) |
| `npm run build:web` | Statik web derlemesi → `dist/` |

## Mimari

```
src/
  app/            Ekranlar (Expo Router; dosya = rota)
    (tabs)/       Alt sekmeler: Vakitler, İbadet, Kıble, Camiler, Canlı
  features/       Özellik modülleri (API kancaları, bileşenler, saf mantık)
  api/            HTTP istemcisi, hata modeli, React Query ayarları, yanıt tipleri
  auth/           Oturum: anonim hesap, token yenileme
  theme/          Tasarım token'ları (renk, gökyüzü gradyanları, tipografi, ölçüler)
  ui/             Ortak bileşenler (Glass, Button, Screen, Sheet, Icon…)
  lib/            Saf yardımcılar (vakit hesabı, tarih, kıble, depolama)
  content/        Yerel içerik (günün ayeti)
```

**Oturum ve güvenlik**
- Her kurulum anonim bir hesapla başlar; Apple/Google/e-posta girişi aynı hesabı yerinde yükseltir.
- Erişim token'ı yalnızca bellekte tutulur. Yenileme token'ı mobilde Keychain/Keystore'da
  (`expo-secure-store`), webde backend'in koyduğu **httpOnly** çerezde durur — sayfa JavaScript'i onu hiç görmez.
- Web istekleri `X-Client-Platform: web` başlığıyla gider; backend çerezi yalnızca izinli kökenden
  ve bu başlıkla kabul eder (CSRF koruması). Yenileme tek uçuşludur (eşzamanlı çağrılar tek isteği paylaşır).
- 401 alındığında bir kez yenilenip tekrar denenir; oturum geçersizse yeni anonim oturum açılır.

**Veri ve çevrimdışı**
- Sunucu verisi TanStack Query ile alınır; vakitler, içerik, ayarlar gibi sorgular cihaza yazılır
  ve uygulama internetsiz de açılır. Konum ve uygulama bayrakları cihazda tutulur.
- Ayarlar sunucuda iyimser eşzamanlılıkla saklanır; 409 gelirse değişiklik güncel kopyaya yeniden uygulanır.
- Zikir sayıları önce cihazda kuyruğa yazılır, bağlantı gelince `batchId` ile tekrarsız eşitlenir.

**Platform farkları**
- Harita: mobilde `react-native-maps`, webde Leaflet (`*.web.tsx` dosyaları).
- Kıble: mobilde pusula sensörü; webde cihaz yön sensörü, yoksa sabit yön ve açıklama.
- Bildirimler ve Apple girişi yalnızca mobilde.

## Yayına alma

**Web:** `client/Dockerfile` statik derlemeyi nginx ile sunar (güvenlik başlıkları ve CSP dahil).
Kökteki `docker-compose.yml` içindeki `web` servisi Traefik arkasında `APP_DOMAIN` ile yayınlar.
`EXPO_PUBLIC_*` değerleri derleme sırasında pakete gömülür.

**Mağazalar (EAS):**
```bash
npx eas-cli@latest login
npx eas-cli@latest init                 # EAS_PROJECT_ID'yi .env'e yazın
npx eas-cli@latest build -p ios --profile production
npx eas-cli@latest build -p android --profile production
npx eas-cli@latest submit -p ios        # / -p android
```
`eas.json` içindeki `EXPO_PUBLIC_API_URL` değerlerini kendi backend adresinizle değiştirin.
`APP_BUNDLE_ID`, `GOOGLE_MAPS_ANDROID_KEY` ve Google OAuth istemci kimlikleri `.env.example`'da listelidir.

## İçerik notu

Günün ayeti listesi (`src/content/verses.ts`), dualar ve Esmaü'l-Hüsna anlamları gibi
yayın öncesi yetkin bir kişi tarafından gözden geçirilmelidir.
