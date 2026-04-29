# Release System

Jeden kod, jedno repo, dwa osobne tory release.

## Zasada

- iOS i Android żyją w tym samym repo `cmok`
- nie używamy ogólnych komend typu `eas build --platform all`
- każdy release idzie przez jawny profil platformy
- `expo.version` to wspólna wersja produktu, widoczna dla ludzi
- `ios.buildNumber` i `android.versionCode` to osobne liczniki techniczne

## Profile EAS

- `ios-preview` , wewnętrzny build iOS
- `ios-production` , build pod App Store / TestFlight
- `android-preview` , wewnętrzny build Android
- `android-production` , build pod Google Play
- `android-internal` , submit do wewnętrznego tracka Play

## Komendy

```bash
npm run build:ios:preview
npm run build:ios:production
npm run submit:ios:production

npm run build:android:preview
npm run build:android:production
npm run submit:android:internal
npm run submit:android:production
```

## Reguły wersjonowania

- `expo.version` zmieniamy przy publicznym release produktu, na przykład `1.0.0` -> `1.0.1`
- `ios.buildNumber` podbijamy ręcznie przed każdym uploadem iOS
- `android.versionCode` podbijamy ręcznie przed każdym uploadem AAB do Play
- nie wyrównujemy na siłę `buildNumber` i `versionCode`, to są różne porządki

## App Store flow

1. `npm run build:ios:production`
2. `npm run submit:ios:production`
3. dalszy review i release już w App Store Connect

## Google Play flow

1. `npm run build:android:production`
2. pierwszy upload do Google Play robimy ręcznie w Play Console
3. po spięciu Play Console API i service account można używać:
4. `npm run submit:android:internal` na testy
5. `npm run submit:android:production` na release do Play

## Przed każdym release

- sprawdź, czy build idzie właściwą komendą platformową
- upewnij się, że store listing i metadata są gotowe dla właściwego sklepu
- nie zakładaj, że iOS review oznacza gotowość Androida
- przed pierwszym Play release sprawdź Android UI, mapy, permission flow i push na prawdziwym urządzeniu
