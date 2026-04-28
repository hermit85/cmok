#!/usr/bin/env bash

set -euo pipefail

source "$(dirname "$0")/android-env.sh"

"$ROOT_DIR/scripts/android-emulator-start.sh"
"$ROOT_DIR/scripts/android-build-debug.sh"

APK_PATH="$ROOT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"

echo "Instaluje APK na emulatorze..."
adb install -r "$APK_PATH"

echo "Uruchamiam appke..."
adb shell monkey -p "$CMOK_ANDROID_PACKAGE" -c android.intent.category.LAUNCHER 1 >/dev/null

echo "cmok debug run gotowy."

