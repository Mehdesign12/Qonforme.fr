// Miniatures YouTube 1280×720 :  node --experimental-strip-types thumbnail.mjs <sortie.png> <dossier-polices> [a|b|c]
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'
import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module'
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../../..')
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright')
const [out, fonts, variant] = process.argv.slice(2)
const PAGE = variant ? 'thumbnail-variants.html' : 'thumbnail.html'
const M = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2' }
const srv = http.createServer((q, s) => { const u = decodeURIComponent(q.url.split('?')[0])
  const f = u === '/' ? path.join(HERE, PAGE) : u.startsWith('/repo/') ? path.join(ROOT, u.slice(6)) : u.startsWith('/public/') ? path.join(ROOT, 'public', u.slice(8)) : u.startsWith('/fonts/') ? path.join(fonts, u.slice(7)) : null
  if (!f || !fs.existsSync(f)) { s.writeHead(404); return s.end() } s.writeHead(200, { 'Content-Type': M[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s) })
await new Promise((r) => srv.listen(0, '127.0.0.1', r))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage()
await p.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil: 'load' }); if (variant) await p.evaluate((v) => document.body.className = v, variant); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300)
await p.screenshot({ path: out }); await b.close(); srv.close()
