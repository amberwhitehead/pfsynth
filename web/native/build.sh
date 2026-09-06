#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
clang --target=wasm32 -O3 -nostdlib -fno-builtin -Inative/include native/engine.c vendor/src/core/pf_partial.c vendor/src/core/pf_attack.c -Wl,--no-entry -Wl,--allow-undefined -Wl,--export=init -Wl,--export=on -Wl,--export=off -Wl,--export=sustain -Wl,--export=panic -Wl,--export=render -Wl,--export-memory -Wl,-z,stack-size=262144 -o native/reference.wasm
