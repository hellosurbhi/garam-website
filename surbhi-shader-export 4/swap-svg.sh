#!/usr/bin/env bash
# Usage: ./swap-svg.sh /path/to/new-logo.svg
set -e

FILE="${1:?Usage: ./swap-svg.sh /path/to/logo.svg}"

if [ ! -f "$FILE" ]; then
    echo "Error: file not found: $FILE"
    exit 1
fi

URI="data:image/svg+xml;base64,$(base64 < "$FILE" | tr -d '\n')"

# Replace the SVG_DATA_URI value in shader-app.js
# Matches the string between the quotes on the SVG_DATA_URI = "..." line
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' -E 's|^(const SVG_DATA_URI = ").*(";$)|\1'"$URI"'\2|' shader-app.js
else
    sed -i -E 's|^(const SVG_DATA_URI = ").*(";$)|\1'"$URI"'\2|' shader-app.js
fi

echo "Done — embedded $(basename "$FILE") ($(wc -c < "$FILE" | tr -d ' ') bytes)"
echo "Open shader.html to see it."
