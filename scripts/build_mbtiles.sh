#!/bin/sh
set -euo pipefail

# Args: GPKG_PATH OUTPUT_DIR LAYERS_STR T_SRS TIPPE_FLAGS
GPKG_PATH="$1"
OUTPUT_DIR="$2"
LAYERS_STR="$3"
T_SRS="$4"
TIPPE_FLAGS="$5"

mkdir -p "$OUTPUT_DIR"

for LYR in $LAYERS_STR; do
  OUT_MB="${OUTPUT_DIR}/${LYR}.mbtiles"
  echo "→ Construyendo ${OUT_MB} (capa: ${LYR})"
  date '+[%H:%M:%S] inicio capa %s' "$LYR" 2>/dev/null || true
  rm -f "$OUT_MB"
  stdbuf -oL -eL ogr2ogr -progress -f GeoJSONSeq /vsistdout/ \
    -t_srs "$T_SRS" \
    "/work/${GPKG_PATH}" "$LYR" \
  | stdbuf -oL -eL tippecanoe -P -o "$OUT_MB" \
      -l "$LYR" \
      -zg \
      $TIPPE_FLAGS
  date '+[%H:%M:%S] fin capa %s' "$LYR" 2>/dev/null || true
done


