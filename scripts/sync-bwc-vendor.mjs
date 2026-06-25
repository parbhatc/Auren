/**

 * Copy lightweight-charts into betterweightchart/public/vendor for Vite static serving.

 * Prefers local sibling lightweightchart checkout when built.

 */

import fs from 'node:fs'

import path from 'node:path'

import { fileURLToPath } from 'node:url'

import { createRequire } from 'node:module'

import { resolveBwcRoot } from './resolve-bwc-root.mjs'



const require = createRequire(import.meta.url)

const aurenRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')



const useDevBundle =

  process.argv.includes('--dev') ||

  (process.env.NODE_ENV !== 'production' && !process.argv.includes('--prod'))



const lcBundle = useDevBundle

  ? 'lightweight-charts.standalone.development.mjs'

  : 'lightweight-charts.standalone.production.mjs'



const SYSTEM_UI_FONT =

  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"



const bwcRoot = resolveBwcRoot()

const vendorDir = path.join(bwcRoot, 'public', 'vendor')

const dest = path.join(vendorDir, 'lightweight-charts.mjs')



function resolveLightweightChartsBundle() {

  const localRoots = [

    process.env.LWC_ROOT,

    path.resolve(aurenRoot, '..', 'lightweightchart'),

    'C:\\Users\\parbh\\OneDrive\\Desktop\\projects\\lightweightchart',

  ].filter(Boolean)



  const candidates = [

    ...localRoots.map((root) => path.join(path.resolve(root), 'dist', lcBundle)),

    path.join(bwcRoot, 'node_modules', 'lightweight-charts', 'dist', lcBundle),

    path.join(

      path.dirname(require.resolve('lightweight-charts/package.json')),

      'dist',

      lcBundle

    ),

  ]



  for (const file of candidates) {

    if (fs.existsSync(file)) return file

  }



  if (fs.existsSync(dest)) {

    console.warn(

      `[sync-bwc-vendor] keeping existing vendor bundle — build ../lightweightchart (${lcBundle}) then retry`

    )

    return null

  }



  console.error(

    '[sync-bwc-vendor] missing',

    lcBundle,

    '— run: cd ../lightweightchart && npm run build, then npm run sync-bwc-vendor'

  )

  process.exit(1)

}



const lcFile = resolveLightweightChartsBundle()



if (lcFile) {

  fs.mkdirSync(vendorDir, { recursive: true })

  fs.copyFileSync(lcFile, dest)

}



const legacy = path.join(vendorDir, 'lightweight-charts-drawing.js')

if (fs.existsSync(legacy)) {

  fs.unlinkSync(legacy)

}



/** @param {string} src @param {string} name @param {number} value */

function setExportConst(src, name, value) {

  return src.replace(new RegExp(`export const ${name} = \\d+;`), `export const ${name} = ${value};`)

}



/** Patch BWC order-line defaults for compact, clean position pills. */

function patchOrderLineSizing() {

  const rowLayoutPath = path.join(bwcRoot, 'public', 'js', 'chart', 'orderLine', 'rowLayout.js')

  const adapterPath = path.join(bwcRoot, 'public', 'js', 'chart', 'orderLine', 'createOrderLineAdapter.js')

  const overlayPath = path.join(

    bwcRoot,

    'public',

    'js',

    'chart',

    'orderLine',

    'orderLineControlsOverlay.js'

  )

  const chartCssPath = path.join(bwcRoot, 'public', 'css', 'chart.css')



  if (fs.existsSync(rowLayoutPath)) {

    let src = fs.readFileSync(rowLayoutPath, 'utf8')

    src = src.replace(

      /export const ORDER_LINE_FONT = "[^"]+";/,

      `export const ORDER_LINE_FONT = "${SYSTEM_UI_FONT}";`

    )

    src = setExportConst(src, 'ORDER_LINE_ROW_H', 20)

    src = setExportConst(src, 'ORDER_LINE_CANCEL_W', 20)

    src = setExportConst(src, 'ORDER_LINE_PAD_X', 6)

    src = setExportConst(src, 'ORDER_LINE_FONT_SIZE', 12)

    src = setExportConst(src, 'ORDER_LINE_MIN_BODY_W', 36)

    src = setExportConst(src, 'ORDER_LINE_MIN_QTY_W', 24)

    src = setExportConst(src, 'DEFAULT_ORDER_LINE_FONT_SIZE', 12)

    src = setExportConst(src, 'DEFAULT_ORDER_LINE_FONT_WEIGHT', 600)

    src = src.replace(

      /ctx\.font = `\$\{axisWeight\} \d+px \$\{axisFamily\}`;/,

      'ctx.font = `${axisWeight} 12px ${axisFamily}`;'

    )

    src = src.replace(

      `function fillBoldText(ctx, text, x, y) {

  ctx.lineWidth = 0.35;

  ctx.strokeStyle = ctx.fillStyle;

  ctx.strokeText(text, x, y);

  ctx.fillText(text, x, y);

}`,

      `function fillBoldText(ctx, text, x, y) {

  ctx.fillText(text, x, y);

}`

    )

    fs.writeFileSync(rowLayoutPath, src)

  }



  if (fs.existsSync(adapterPath)) {

    let src = fs.readFileSync(adapterPath, 'utf8')

    src = src

      .replace(/bodyFontSize: \d+,/, 'bodyFontSize: 12,')

      .replace(/quantityFontSize: \d+,/, 'quantityFontSize: 12,')

      .replace(/bodyFontWeight: \d+,/, 'bodyFontWeight: 600,')

      .replace(/quantityFontWeight: \d+,/, 'quantityFontWeight: 600,')

    fs.writeFileSync(adapterPath, src)

  }



  if (fs.existsSync(overlayPath)) {

    let src = fs.readFileSync(overlayPath, 'utf8')

    src = src.replace(

      `  el.style.setProperty("-webkit-font-smoothing", "auto");

  el.style.setProperty("-moz-osx-font-smoothing", "auto");

  el.style.setProperty("-webkit-text-stroke", "0.35px currentColor");

  el.style.setProperty("paint-order", "stroke fill");`,

      `  el.style.setProperty("-webkit-font-smoothing", "antialiased");

  el.style.setProperty("-moz-osx-font-smoothing", "grayscale");`

    )

    src = src.replace(

      `    if (shellBorder) {

      el.style.border = \`1px solid \${shellBorder}\`;

      el.style.borderRadius = "2px";

      el.style.boxShadow = "none";

    } else {

      el.style.border = "";

      el.style.borderRadius = "";

      el.style.boxShadow = "";

    }`,

      `    el.style.border = "none";

    el.style.borderRadius = "3px";

    el.style.boxShadow = "0 1px 3px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)";`

    )

    src = src.replace(

      `      if (qtyDiv) {

        qty.style.borderLeft = \`1px solid \${qtyDiv}\`;

        qty.style.borderRight = \`1px solid \${qtyDiv}\`;

      }`,

      `      qty.style.borderLeft = "1px solid rgba(255,255,255,0.28)";

      qty.style.borderRight = "1px solid rgba(255,255,255,0.28)";`

    )

    fs.writeFileSync(overlayPath, src)

  }



  if (fs.existsSync(chartCssPath)) {

    let src = fs.readFileSync(chartCssPath, 'utf8')

    src = src.replace(

      `.order-line-control__body,

.order-line-control__qty {

  font-family: "Trebuchet MS", Roboto, Ubuntu, sans-serif;

  font-size: 12px;

  font-weight: 900;

  line-height: 1;

  font-synthesis: weight;

  -webkit-font-smoothing: auto;

  -moz-osx-font-smoothing: auto;

  -webkit-text-stroke: 0.35px currentColor;

  paint-order: stroke fill;

  letter-spacing: -0.01em;

}`,

      `.order-line-control__body,

.order-line-control__qty {

  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  font-size: 12px;

  font-weight: 600;

  line-height: 1;

  font-synthesis: none;

  -webkit-font-smoothing: antialiased;

  -moz-osx-font-smoothing: grayscale;

  letter-spacing: -0.02em;

}`

    )

    src = src.replace(

      `.order-line-control__segment {

  display: flex;

  align-items: center;

  justify-content: center;

  border: 0;

  padding: 0;

  margin: 0;

  font-size: 12px;

  cursor: default;

  line-height: 1;

  flex-shrink: 0;

  transition: filter var(--duration-fast) var(--ease-out);

  font-weight: 900;

}`,

      `.order-line-control__segment {

  display: flex;

  align-items: center;

  justify-content: center;

  border: 0;

  padding: 0;

  margin: 0;

  font-size: 12px;

  cursor: default;

  line-height: 1;

  flex-shrink: 0;

  transition: filter var(--duration-fast) var(--ease-out);

  font-weight: 600;

}`

    )

    fs.writeFileSync(chartCssPath, src)

  }

}



patchOrderLineSizing()



if (lcFile) {

  console.log(

    `[sync-bwc-vendor] wrote ${path.relative(process.cwd(), dest)} <- ${path.relative(aurenRoot, lcFile)}${useDevBundle ? ' (dev)' : ''}`

  )

}

console.log('[sync-bwc-vendor] patched BWC order-line pill styling')


