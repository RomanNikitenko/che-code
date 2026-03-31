#!/bin/sh
set -eu

RUNTIME_DIR="${1:-/checode/checode-linux-libc/ubi9}"
LIBS_DIR="${RUNTIME_DIR}/ld_libs"
NODE_BIN="${RUNTIME_DIR}/node"

echo "Runtime: ${RUNTIME_DIR}"
echo "Libs:    ${LIBS_DIR}"
echo "Node:    ${NODE_BIN}"
echo

if [ ! -x "${NODE_BIN}" ]; then
  echo "ERROR: node binary not found: ${NODE_BIN}" >&2
  exit 1
fi

if [ ! -d "${LIBS_DIR}" ]; then
  echo "ERROR: libs dir not found: ${LIBS_DIR}" >&2
  exit 1
fi

if ! command -v objdump >/dev/null 2>&1; then
  echo "ERROR: objdump is required (install binutils in the container)." >&2
  exit 1
fi

TMP_NEEDS="$(mktemp)"
TMP_HAVE="$(mktemp)"
TMP_MISS="$(mktemp)"
trap 'rm -f "$TMP_NEEDS" "$TMP_HAVE" "$TMP_MISS"' EXIT

# Collect what we have in ld_libs (basename only).
find "${LIBS_DIR}" -maxdepth 1 -type f -name '*.so*' -exec basename {} \; | sort -u > "${TMP_HAVE}"

scan_needed() {
  f="$1"
  objdump -p "$f" 2>/dev/null | awk '/NEEDED/ {print $2}' || true
}

# Scan node and all native addons.
scan_needed "${NODE_BIN}" >> "${TMP_NEEDS}"
find "${RUNTIME_DIR}" -type f -name '*.node' 2>/dev/null | while read -r so; do
  # Ignore non-linux prebuilt addons to reduce noise.
  case "$so" in
    *win32*|*windows*|*darwin*|*macos*) continue ;;
  esac
  scan_needed "$so" >> "${TMP_NEEDS}"
done

sort -u "${TMP_NEEDS}" -o "${TMP_NEEDS}"

echo "=== NEEDED (unique) ==="
cat "${TMP_NEEDS}"
echo

echo "=== HAVE in ld_libs ==="
cat "${TMP_HAVE}"
echo

# Ignore glibc core, usually expected from the host/container base.
grep -Ev '^(linux-vdso\.so\.1|libc\.so\.6|libm\.so\.6|libpthread\.so\.0|libdl\.so\.2|librt\.so\.1|ld-linux-.*\.so.*)$' "${TMP_NEEDS}" > "${TMP_MISS}" || true

echo "=== MISSING in ld_libs (excluding glibc core) ==="
MISSING_COUNT=0
while read -r need; do
  [ -z "$need" ] && continue
  if ! grep -qx "$need" "${TMP_HAVE}"; then
    echo "$need"
    MISSING_COUNT=$((MISSING_COUNT + 1))
  fi
done < "${TMP_MISS}"

echo
if [ "${MISSING_COUNT}" -eq 0 ]; then
  echo "OK: no missing non-glibc SONAMEs in ld_libs"
else
  echo "FAIL: missing ${MISSING_COUNT} SONAME(s)"
  exit 2
fi
