#!/usr/bin/env bash

set -euo pipefail

source "$(dirname "$0")/android-env.sh"

if adb devices | awk 'NR>1 {print $1}' | grep -q '^emulator-'; then
  echo "Emulator juz dziala."
  adb devices
  exit 0
fi

if ! avdmanager list avd | grep -q "Name: ${CMOK_ANDROID_AVD}\$"; then
  echo "Tworze AVD ${CMOK_ANDROID_AVD}..."
  echo "no" | avdmanager create avd \
    -n "$CMOK_ANDROID_AVD" \
    -k "$CMOK_ANDROID_SYSTEM_IMAGE" \
    --device "$CMOK_ANDROID_DEVICE" >/dev/null
fi

echo "Uruchamiam emulator ${CMOK_ANDROID_AVD}..."
EMULATOR_ARGS=(
  -avd "$CMOK_ANDROID_AVD"
  -no-snapshot
  -no-boot-anim
  -gpu swiftshader_indirect
  -no-audio
)

if [[ "${CMOK_ANDROID_HEADLESS:-0}" == "1" ]]; then
  EMULATOR_ARGS+=(-no-window)
fi

nohup "$ANDROID_SDK_ROOT/emulator/emulator" "${EMULATOR_ARGS[@]}" \
  >"$CMOK_ANDROID_EMULATOR_LOG" 2>&1 &

echo "Czekam na adb..."
adb wait-for-device

for _ in $(seq 1 120); do
  if [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; then
    for _ in $(seq 1 30); do
      if adb get-state >/dev/null 2>&1 && adb shell service check package 2>/dev/null | grep -q "found"; then
        stable=1
        for _ in $(seq 1 30); do
          sleep 1
          if ! adb get-state >/dev/null 2>&1 || ! adb shell service check package 2>/dev/null | grep -q "found"; then
            stable=0
            break
          fi
        done
        if [[ "$stable" == "1" ]]; then
          adb shell input keyevent 82 >/dev/null 2>&1 || true
          echo "Emulator gotowy."
          adb devices
          exit 0
        fi
      fi
      sleep 1
    done
    break
  fi
  sleep 2
done

echo "Emulator nie skonczyl stabilnego bootu. Log: $CMOK_ANDROID_EMULATOR_LOG" >&2
exit 1
