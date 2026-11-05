set -e
cd /root/Auren
printf 'BWC source\n'
node --input-type=module -e 'import {resolveBwcRoot} from "./scripts/resolve-bwc-root.mjs"; console.log(resolveBwcRoot())'
printf '\nServer-only files\n'
find server/src/services/propFirms -maxdepth 2 -type f -printf '%p\n' 2>/dev/null || true
printf '\nBWC npm lock\n'
node -e 'let p=require("./package-lock.json");let b=p.packages["node_modules/betterweightchartpro"]; console.log(b.resolved)'
