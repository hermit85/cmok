# Android Local Ready

To jest lokalny tor Android dla `cmok`, zanim dojdzie Firebase i Google Play Console.

## Co jest juz gotowe

- Android SDK i emulator sa postawione
- lokalny AVD moze nazywac sie `cmok-api35`
- build uzywa Java 17
- sa skrypty do doctor, startu emulatora, builda i instalacji debug APK
- `cmok` ma osobny Android release flow w `eas.json`

## Komendy lokalne

```bash
npm run android:doctor
npm run android:emu:start
npm run android:build:debug
npm run android:run:debug
npm run android:emu:stop
```

## Co sprawdzisz juz teraz bez Firebase

- czy appka sie buduje na Androidzie
- czy emulator startuje
- czy onboarding i podstawowe ekrany wygladaja poprawnie
- czy Android-specific flow nie ma oczywistych bugow UI i nawigacji
- czy Maestro flows daja sie odpalic lokalnie po postawieniu builda

## Czego jeszcze nie sprawdzisz bez Firebase i prawdziwego telefonu

- produkcyjnych pushy na Androidzie
- rejestracji FCM pod `expo-notifications`
- pelnego permission flow push
- zachowania po kliknieciu w systemowy push

## Po dostaniu dostepu do Firebase

1. dodaj `google-services.json` do root repo
2. wrzuc FCM V1 service account key do EAS credentials
3. zrob nowy Android build
4. przetestuj push na prawdziwym telefonie

## Po dostaniu dostepu do Google Play Console

1. utworz appke w Play Console
2. wrzuc pierwszy `.aab` recznie
3. dopnij store listing, Data safety i polityke prywatnosci
4. dopiero potem uzywaj `eas submit` do kolejnych wrzutek

## Uwaga praktyczna

Pierwszy `gradlew` na swiezej maszynie moze byc wolny i czasem lapie timeouty przy pobieraniu zaleznosci z Maven Central. W takim przypadku po prostu odpal ten sam build jeszcze raz.
