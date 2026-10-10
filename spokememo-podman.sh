#!/usr/bin/env bash
# Podman for SpokeMemo only. Images and volumes stay on Dados Bazzite.
set -euo pipefail
root="$(cd "$(dirname "$0")" && pwd)/.podman"
mkdir -p "$root/storage" "$root/run" "$root/tmp"
export TMPDIR="$root/tmp"
exec podman --root "$root/storage" --runroot "$root/run" "$@"
