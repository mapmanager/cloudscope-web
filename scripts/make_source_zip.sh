#!/usr/bin/env bash
# Source zip of the files needed to install, verify, build, and redeploy.
# Omit data/, dist/, node_modules/, public/samples/, zips/, and generated caches.
# Always writes to zips/cloudscope-web-YYYYMMDD-vN.zip (N increments for today's date).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

ZIPS_DIR="$REPO_ROOT/zips"
mkdir -p "$ZIPS_DIR"

TODAY="$(date +%Y%m%d)"
PREFIX="cloudscope-web-${TODAY}-v"

NEXT_N=1
shopt -s nullglob
for existing in "$ZIPS_DIR"/${PREFIX}*.zip; do
    base="$(basename "$existing" .zip)"
    suffix="${base#"$PREFIX"}"
    if [[ "$suffix" =~ ^[0-9]+$ ]]; then
        n=$((10#$suffix))
        if (( n >= NEXT_N )); then
            NEXT_N=$((n + 1))
        fi
    fi
done
shopt -u nullglob

ZIP_PATH="$ZIPS_DIR/${PREFIX}${NEXT_N}.zip"
rm -f "$ZIP_PATH"

# Allowlist of source paths. Skip any that are absent so the zip does not fail.
INCLUDE_CANDIDATES=(
    src
    tests
    scripts
    public
    .github
    .githooks
    index.html
    package.json
    package-lock.json
    vite.config.ts
    tsconfig.json
    tsconfig.app.json
    tsconfig.node.json
    eslint.config.js
    README.md
    AGENTS.md
    .gitignore
    .prettierrc.json
    .prettierignore
)

INCLUDE=()
for path in "${INCLUDE_CANDIDATES[@]}"; do
    if [[ -e "$path" ]]; then
        INCLUDE+=("$path")
    fi
done

zip -r "$ZIP_PATH" \
    "${INCLUDE[@]}" \
    -x \
    "node_modules/*" \
    "dist/*" \
    "data/*" \
    "zips/*" \
    "public/samples/*" \
    "coverage/*" \
    ".vite/*" \
    ".git/*" \
    "tmp/*" \
    "tmp-to-be-deleted/*" \
    "*/.DS_Store" \
    "*/.idea/*" \
    "*/.vscode/*" \
    "*.zip" \
    "*.tsbuildinfo" \
    ".eslintcache" \
    ".env" \
    ".env.*"

echo "Created: $ZIP_PATH"
ls -lh "$ZIP_PATH"
