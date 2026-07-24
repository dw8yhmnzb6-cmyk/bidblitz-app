#!/usr/bin/env bash
# Convert SVGs in public/ to required PNG sizes for Stores (Apple + Play)
# Requires: rsvg-convert (apt install librsvg2-bin) OR ImageMagick (apt install imagemagick)

set -e
DIR="$(dirname "$(readlink -f "$0")")/../public"
OUT="$DIR/store-assets"
mkdir -p "$OUT"

ICON="$DIR/app-icon-1024.svg"
FEATURE="$DIR/store-feature-1024x500.svg"

if ! [ -f "$ICON" ] || ! [ -f "$FEATURE" ]; then
  echo "❌ SVG sources missing in $DIR"
  exit 1
fi

# Choose converter
if command -v rsvg-convert &> /dev/null; then
  CMD="rsvg-convert"
elif command -v magick &> /dev/null; then
  CMD="imagemagick"
elif command -v convert &> /dev/null; then
  CMD="convert"
else
  echo "❌ Neither rsvg-convert nor ImageMagick installed."
  echo "   Install: apt install librsvg2-bin   OR   brew install librsvg"
  exit 1
fi

render() {
  local src=$1
  local dst=$2
  local w=$3
  local h=$4
  case "$CMD" in
    rsvg-convert) rsvg-convert -w "$w" -h "$h" -o "$dst" "$src" ;;
    imagemagick)  magick -background none -density 300 "$src" -resize "${w}x${h}" "$dst" ;;
    convert)      convert -background none -density 300 "$src" -resize "${w}x${h}" "$dst" ;;
  esac
  echo "✓ $dst"
}

# App icons (Apple + Android requirements)
render "$ICON" "$OUT/icon-1024.png" 1024 1024  # iOS App Store
render "$ICON" "$OUT/icon-512.png"  512 512    # Play Store  + PWA
render "$ICON" "$OUT/icon-192.png"  192 192    # PWA
render "$ICON" "$OUT/icon-180.png"  180 180    # iOS Touch Icon
render "$ICON" "$OUT/icon-167.png"  167 167    # iPad Pro
render "$ICON" "$OUT/icon-152.png"  152 152    # iPad
render "$ICON" "$OUT/icon-120.png"  120 120    # iPhone
render "$ICON" "$OUT/icon-87.png"   87 87      # iPhone settings 3x
render "$ICON" "$OUT/icon-58.png"   58 58      # Settings 2x

# Play Store Feature Graphic (1024×500) + Apple App Store Card (no specific size, reuse)
render "$FEATURE" "$OUT/feature-1024x500.png" 1024 500

# Adaptive icons (Android — foreground only, transparent bg)
render "$ICON" "$OUT/adaptive-icon-432.png" 432 432

echo ""
echo "✅ All store assets generated in $OUT"
ls -la "$OUT"
