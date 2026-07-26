#!/usr/bin/env bash
# Build a GNOME Shell extension zip for extensions.gnome.org submission.
#
# The repo root IS the extension directory. The zip contains only the
# extension files (metadata.json, extension.js, icons/). README, LICENSE,
# build.sh, .gitignore and build/ are intentionally excluded per the
# review guidelines ("don't include unnecessary files").
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$ROOT/build"

if [ ! -f "$ROOT/metadata.json" ] || [ ! -f "$ROOT/extension.js" ]; then
    echo "metadata.json or extension.js not found in: $ROOT" >&2
    exit 1
fi

UUID=$(python3 -c "import json,sys;print(json.load(open('$ROOT/metadata.json'))['uuid'])")
ZIP_NAME="${UUID}.shell-extension.zip"

rm -rf "$OUT"
mkdir -p "$OUT"

# Validate JSON metadata
python3 -c "import json;json.load(open('$ROOT/metadata.json'))" \
    && echo "metadata.json: valid"

# Validate JS syntax if node is available
if command -v node >/dev/null 2>&1; then
    node --check "$ROOT/extension.js" && echo "extension.js: syntax OK"
fi

# Create the zip from the repo root, excluding non-extension files.
( cd "$ROOT" && zip -r -q "$OUT/$ZIP_NAME" \
    metadata.json extension.js icons/ \
    -x '*.gschema.valid' 'schemas/*.compiled' '*.shell-extension.zip' )

echo "Built: $OUT/$ZIP_NAME"
( cd "$OUT" && unzip -l "$ZIP_NAME" )