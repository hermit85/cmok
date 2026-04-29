# Google Play Checklist

Stan na dziś dla `cmok`: iOS i Android mają wspólny kod, ale osobny release flow.

## Co już jest gotowe

- package Android: `com.hermit85.cmok`
- osobny `android.versionCode`
- osobne profile EAS pod Android build i submit
- poprawiony link do map na Androidzie w alarmie
- lokalne narzędzia Android SDK / emulator są skonfigurowane na tym Macu
- `google-services.json` jest lokalnie obecny i ignorowany przez git
- EAS build profile mają jawne środowiska `preview` / `production`
- root `sentry.properties` nie jest trzymany w git, token ma iść przez `SENTRY_AUTH_TOKEN`

## Co jeszcze blokuje sensowny Android release

### 1. EAS secrets i credentials

Przed buildem w chmurze trzeba ustawić sekrety po stronie Expo/EAS:

```bash
npx eas-cli env:create --scope project --environment production \
  --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json \
  --visibility secret --force

npx eas-cli env:create --scope project --environment preview \
  --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json \
  --visibility secret --force
```

Sentry source maps:

```bash
npx eas-cli env:create --scope project --environment production \
  --name SENTRY_AUTH_TOKEN --value "<sentry-auth-token>" \
  --visibility sensitive --force
```

FCM V1 service account dla push:

```bash
npx eas-cli credentials -p android
```

Wybierz `Android` → `production` → `Google Service Account` → FCM V1 → upload JSON service account key.

### 2. Firebase / FCM dla Android push

Co trzeba zrobić:

1. Sprawdzić w Firebase, że projekt to `cmok-9bd2a`
2. Sprawdzić, że aplikacja Android ma package `com.hermit85.cmok`
3. Ograniczyć Firebase API key do Android app package + SHA certów release
4. Ustawić billing/quota alerty po stronie Google Cloud
5. Dodać FCM V1 service account key w EAS Credentials

`app.config.ts` już to obsługuje warunkowo. Gdy plik istnieje, build podepnie go automatycznie.

### 3. Google Play Console

Trzeba przygotować:

1. konto deweloperskie Google Play
2. aplikację w Play Console
3. store listing
4. politykę prywatności
5. Data safety
6. content rating

Uwaga:

- pierwszy upload do Google Play robimy ręcznie w Play Console
- dopiero kolejne submission można wygodnie puszczać przez EAS Submit
- nowe osobiste konta deweloperskie mogą wymagać closed testing przed produkcją

## Kanoniczne komendy Android

```bash
npm run build:android:preview
npm run build:android:production
npm run submit:android:internal
npm run submit:android:production
```

Nie używamy:

```bash
eas build --platform all
```

## Kolejność prac

### Etap 1. Emulator i local QA

1. Zainstalować Android Studio lub command line tools
2. Doinstalować Android SDK, platform tools i emulator
3. Utworzyć AVD
4. Odpalić `cmok` na emulatorze
5. Przejść podstawowe flow:
   - logowanie
   - onboarding
   - home signaler
   - home recipient
   - trusted support
   - SOS bez i z lokalizacją

### Etap 2. Push i prawdziwe urządzenie

Emulator nie wystarczy do finalnego testu push.

W kodzie `registerPushToken()` pomija urządzenia nie-fizyczne, więc:

- emulator nadaje się do UI i nawigacji
- prawdziwy Android jest potrzebny do końcowego testu push i permission flow

### Etap 3. Pierwszy Play release

1. Upewnić się, że `android.versionCode` nie był wcześniej uploadowany do Play
2. Zbudować `.aab` przez `npm run build:android:production`
2. Wgrać pierwszy build ręcznie do Play Console
3. Jeśli Google wymaga, przejść closed testing
4. Dopiero potem używać EAS submit do kolejnych wydań

## Różnice iOS vs Android, które trzeba pilnować

- iOS używa `ios.buildNumber`
- Android używa `android.versionCode`
- iOS submit idzie do App Store Connect
- Android submit idzie do Play Console
- iOS push używa APNs
- Android push używa FCM
- iOS review nie oznacza gotowości Androida

## Szybki verdict dla `cmok`

`cmok` jest Android-ready na poziomie kodu i lokalnego toolchainu. Do Play-ready operacyjnie zostają kroki po stronie kont zewnętrznych.

Największe realne braki:

- upload `GOOGLE_SERVICES_JSON` do EAS env
- upload FCM V1 service account key do EAS credentials
- rotacja starego Sentry tokena, który był wcześniej w historii git
- brak pierwszego ręcznego setupu w Google Play Console
