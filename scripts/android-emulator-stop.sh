#!/usr/bin/env bash

set -euo pipefail

source "$(dirname "$0")/android-env.sh"

if adb devices | awk 'NR>1 {print $1}' | rg -q '^emulator-'; then
  adb -e emu kill
  echo "Zatrzymuje emulator."
else
  echo "Brak uruchomionego emulatora."
fi

