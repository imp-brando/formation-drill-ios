#!/bin/sh
# Rebuild the single-file game from src/ parts (no build tools needed).
# Also refreshes the offline copy bundled into the iOS app (ios/FormationDrill/Web/index.html).
cd "$(dirname "$0")"
{ cat src/part1.html src/part2.html; echo '<script id="main">'; cat src/part3.js src/part3b.js src/part4.js src/part5.js src/part6.js; echo '</script>'; echo '</body></html>'; } > index.html
if [ -d ios/FormationDrill ]; then mkdir -p ios/FormationDrill/Web/icons && cp index.html manifest.webmanifest ios/FormationDrill/Web/ && cp icons/*.png ios/FormationDrill/Web/icons/; fi
