#!/bin/bash
# Copy OpenMCT dist files from node_modules to public/roc/openmct/
# Runs as part of the build process (prebuild script)

set -e

SRC="node_modules/openmct/dist"
DEST="public/roc/openmct"

if [ ! -d "$SRC" ]; then
  echo "OpenMCT dist not found at $SRC — skipping copy"
  exit 0
fi

echo "Copying OpenMCT dist to $DEST..."
rm -rf "$DEST"
mkdir -p "$DEST"

# Core JS
cp "$SRC/openmct.js" "$DEST/"
cp "$SRC/openmct.js.map" "$DEST/" 2>/dev/null || true

# Themes
for theme in darkmatterTheme espressoTheme snowTheme; do
  cp "$SRC/${theme}.js" "$DEST/" 2>/dev/null || true
  cp "$SRC/${theme}.js.map" "$DEST/" 2>/dev/null || true
  cp "$SRC/${theme}.css" "$DEST/" 2>/dev/null || true
  cp "$SRC/${theme}.css.map" "$DEST/" 2>/dev/null || true
done

# Workers
cp "$SRC/couchDBChangesFeed.js" "$DEST/" 2>/dev/null || true
cp "$SRC/generatorWorker.js" "$DEST/" 2>/dev/null || true
cp "$SRC/inMemorySearchWorker.js" "$DEST/" 2>/dev/null || true

# Static assets
cp -r "$SRC/favicons" "$DEST/" 2>/dev/null || true
cp -r "$SRC/fonts" "$DEST/" 2>/dev/null || true
cp -r "$SRC/images" "$DEST/" 2>/dev/null || true

echo "OpenMCT dist copied ($(du -sh "$DEST" | cut -f1))"
