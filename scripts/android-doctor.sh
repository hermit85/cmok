#!/usr/bin/env bash

set -euo pipefail

source "$(dirname "$0")/android-env.sh"

echo "cmok android doctor"
echo "root: $ROOT_DIR"
echo "java_home: $JAVA_HOME"
echo "android_sdk_root: $ANDROID_SDK_ROOT"
echo

for cmd in java adb avdmanager sdkmanager; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Brak komendy: $cmd" >&2
    exit 1
  fi
  printf "ok  %-10s %s\n" "$cmd" "$(command -v "$cmd")"
done

if [[ -x "$ANDROID_SDK_ROOT/emulator/emulator" ]]; then
  printf "ok  %-10s %s\n" "emulator" "$ANDROID_SDK_ROOT/emulator/emulator"
else
  echo "Brak emulator binary w $ANDROID_SDK_ROOT/emulator/emulator" >&2
  exit 1
fi

echo
java -version 2>&1 | sed -n '1,2p'
echo
echo "zainstalowane pakiety sdk:"
sdkmanager --sdk_root="$ANDROID_SDK_ROOT" --list_installed | sed -n '1,80p'
echo
echo "avd:"
avdmanager list avd | sed -n '1,80p'
echo
echo "adb devices:"
adb devices
echo
if [[ -f "$ROOT_DIR/google-services.json" ]]; then
  echo "google-services.json: obecny"
else
  echo "google-services.json: brak, to jest normalne przed Firebase"
fi

