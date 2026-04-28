#!/usr/bin/env bash

set -euo pipefail

source "$(dirname "$0")/android-env.sh"

if [[ ! -d "$ROOT_DIR/android" ]]; then
  echo "Brak katalogu android, uruchamiam expo prebuild..."
  (
    cd "$ROOT_DIR"
    npx expo prebuild --platform android
  )
fi

echo "Buduje debug APK..."
(
  cd "$ROOT_DIR/android"
  ./gradlew app:assembleDebug -x lint -x test \
    --console=plain \
    --stacktrace \
    --no-daemon \
    --max-workers=2 \
    -Dorg.gradle.internal.http.connectionTimeout=120000 \
    -Dorg.gradle.internal.http.socketTimeout=120000
)

APK_PATH="$ROOT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
if [[ -f "$APK_PATH" ]]; then
  echo "Gotowe: $APK_PATH"
else
  echo "Build przeszedl bez odnalezienia app-debug.apk" >&2
  exit 1
fi

