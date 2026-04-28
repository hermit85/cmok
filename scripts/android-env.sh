#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

OPENJDK17_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
OPENJDK17_BIN="/opt/homebrew/opt/openjdk@17/bin"
ANDROID_SDK_DEFAULT="/opt/homebrew/share/android-commandlinetools"

if [[ ! -d "$OPENJDK17_HOME" ]]; then
  echo "Brak openjdk@17 w /opt/homebrew. Zainstaluj: brew install openjdk@17" >&2
  exit 1
fi

if [[ ! -d "$ANDROID_SDK_DEFAULT" ]]; then
  echo "Brak Android SDK w /opt/homebrew/share/android-commandlinetools" >&2
  exit 1
fi

export JAVA_HOME="${JAVA_HOME:-$OPENJDK17_HOME}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_SDK_DEFAULT}"
export ANDROID_HOME="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
export PATH="$OPENJDK17_BIN:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$PATH"
export CMOK_ANDROID_AVD="${CMOK_ANDROID_AVD:-cmok-api35}"
export CMOK_ANDROID_DEVICE="${CMOK_ANDROID_DEVICE:-pixel_8}"
export CMOK_ANDROID_SYSTEM_IMAGE="${CMOK_ANDROID_SYSTEM_IMAGE:-system-images;android-35;google_apis_playstore;arm64-v8a}"
export CMOK_ANDROID_PACKAGE="${CMOK_ANDROID_PACKAGE:-com.hermit85.cmok}"
export CMOK_ANDROID_EMULATOR_LOG="${CMOK_ANDROID_EMULATOR_LOG:-/tmp/cmok-android-emulator.log}"

mkdir -p "$HOME/.android"
touch "$HOME/.android/repositories.cfg"

