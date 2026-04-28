# Google Play Checklist

Stan na dziś dla `cmok`: iOS i Android mają wspólny kod, ale osobny release flow.

## Co już jest gotowe

- package Android: `com.hermit85.cmok`
- osobny `android.versionCode`
- osobne profile EAS pod Android build i submit
- poprawiony link do map na Androidzie w alarmie

## Co jeszcze blokuje sensowny Android release

### 1. Lokalne środowisko Android

Na tym Macu nie ma jeszcze:

- `adb`
- `emulator`
- lokalnego Android SDK

Bez tego nie zrobimy lokalnego smoke testu na emulatorze.

### 2. Firebase / FCM dla Android push

Repo nie ma jeszcze `google-services.json`.

To jest potrzebne, jeśli `cmok` ma działać z Expo Push na Androidzie.

Co trzeba zrobić:

1. Założyć lub wybrać projekt Firebase dla `com.hermit85.cmok`
2. Dodać tam aplikację Android `com.hermit85.cmok`
3. Pobrać `google-services.json`
4. Wrzucić plik do root repo jako `./google-services.json`
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

1. Zbudować `.aab` przez `npm run build:android:production`
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

`cmok` jest blisko Android-ready na poziomie kodu, ale nie jest jeszcze Play-ready operacyjnie.

Największe realne braki:

- brak lokalnego Android SDK / emulatora
- brak `google-services.json`
- brak spiętego FCM V1 w EAS
- brak pierwszego ręcznego setupu w Google Play Console
