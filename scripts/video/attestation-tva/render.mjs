// Rend la vidéo « Fini l'attestation de TVA à faire signer » en MP4 1920×1080.
//
//   node --experimental-strip-types scripts/video/attestation-tva/render.mjs <dossier-de-sortie> [--fps 25] [--only 12.5] [--audio <dossier-des-mp3>]
//
// Sans --audio : aperçu muet, durées estimées sur la lecture à voix haute.
// Avec --audio : scene-01.mp3 … scene-08.mp3 fixent la durée de chaque scène (+ 0,8 s de respiration)
// et sont montés sur la vidéo. Rendu déterministe : animations Web mises en pause puis positionnées.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../../..')
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright')

const args = process.argv.slice(2)
const OUT = path.resolve(args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--fps' && args[args.indexOf(a) - 1] !== '--only' && args[args.indexOf(a) - 1] !== '--audio') || 'out')
const opt = (n, d) => (args.includes('--' + n) ? args[args.indexOf('--' + n) + 1] : d)
const FPS = +opt('fps', 25)
const ONLY = opt('only', null)
const AUDIO = opt('audio', null)
fs.mkdirSync(OUT, { recursive: true })
const CACHE = path.join(OUT, 'cache')
fs.mkdirSync(path.join(CACHE, 'fonts'), { recursive: true })

const script = JSON.parse(fs.readFileSync(path.join(HERE, 'script.fr.json'), 'utf8'))
const cert = await import(pathToFileURL(path.join(ROOT, 'lib/legal/certification-tva.ts')).href)

/* ── durées ── */
const probe = (f) => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim()
let t = 0
const scenes = script.scenes.map((s, i) => {
  let dur
  const mp3 = AUDIO && path.join(AUDIO, `scene-${String(i + 1).padStart(2, '0')}.mp3`)
  if (mp3 && fs.existsSync(mp3)) dur = probe(mp3) + 0.8
  else dur = Math.max(s.min, s.voix.length / 14 + 1.2)   // ~14 caractères par seconde en français posé
  const out = { id: s.id, t0: t, dur: Math.round(dur * 40) / 40, mp3: mp3 && fs.existsSync(mp3) ? mp3 : null }
  t += out.dur
  return out
})
const total = t

/* ── polices DM Sans (Google Fonts, latin) ── */
function curl(url, file) {
  const a = ['-sSfL', '--max-time', '60', '-A', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36']
  if (file) a.push('-o', file)
  a.push(url)
  return execFileSync('curl', a, { encoding: file ? undefined : 'utf8' })
}
for (const w of [400, 500, 600]) {
  const f = path.join(CACHE, 'fonts', `dm-${w}.woff2`)
  if (fs.existsSync(f) && fs.statSync(f).size > 1000) continue
  const css = curl(`https://fonts.googleapis.com/css2?family=DM+Sans:wght@${w}&display=swap`)
  const blocks = css.split('@font-face').filter((b) => /unicode-range/.test(b) && /U\+0000-00FF/.test(b))
  const url = (blocks[0] || css).match(/url\((https:[^)]+\.woff2)\)/)[1]
  curl(url, f)
}

/* ── icônes Lucide ── */
const iconNames = ['house', 'file-pen', 'pen-line', 'archive', 'calendar', 'file-check', 'circle-check', 'building-2', 'file-text']
const icons = {}
for (const n of iconNames) {
  const mod = await import(pathToFileURL(path.join(ROOT, `node_modules/lucide-react/dist/esm/icons/${n}.js`)).href)
  icons[n] = mod.__iconNode
    .map(([tag, a]) => `<${tag} ${Object.entries(a).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ')}/>`)
    .join('')
}

/* ── capture réelle de /modele ── */
const modelePng = path.join(CACHE, 'modele.png')
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined
const launch = () => chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--font-render-hinting=none'] })
if (!fs.existsSync(modelePng)) {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'], proxy })
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, locale: 'fr-FR', ignoreHTTPSErrors: true })
  const p = await ctx.newPage()
  await p.goto('https://qonforme.fr/modele', { waitUntil: 'load', timeout: 60000 })
  await p.waitForTimeout(2500)
  await p.evaluate(() => {
    document.querySelectorAll('*').forEach((e) => {
      if (getComputedStyle(e).position === 'fixed' && e.getBoundingClientRect().top > 400) e.style.display = 'none'
    })
  })
  await p.screenshot({ path: modelePng, clip: { x: 0, y: 0, width: 1280, height: 1100 }, fullPage: true })
  await b.close()
}

/* ── serveur statique ── */
const MIME = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2', '.js': 'text/javascript' }
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0])
  let f
  if (u === '/') f = path.join(HERE, 'scene.html')
  else if (u.startsWith('/repo/')) f = path.join(ROOT, u.slice(6))
  else if (u.startsWith('/public/')) f = path.join(ROOT, 'public', u.slice(8))
  else if (u.startsWith('/fonts/')) f = path.join(CACHE, 'fonts', u.slice(7))
  else if (u === '/modele.png') f = modelePng
  if (!f || !f.startsWith(ROOT) && !f.startsWith(CACHE) && !f.startsWith(HERE) || !fs.existsSync(f)) { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' })
  fs.createReadStream(f).pipe(res)
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const BASE = `http://127.0.0.1:${server.address().port}`

const data = {
  scenes, total, icons,
  mention: {
    devis: cut(cert.CERTIFICATION_DEVIS_10, 250),
    facture: cut(cert.CERTIFICATION_FACTURE_10, 250),
  },
  src: Object.fromEntries(script.scenes.map((s) => [s.id, s.source || ''])),
  assets: { photoClient: '/public/landing/photos/artisan-client.webp', modele: '/modele.png' },
}
function cut(s, n) { return s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n)) + ' […]' }

/* ── rendu des images ── */
const frames = path.join(OUT, 'frames')
fs.rmSync(frames, { recursive: true, force: true })
fs.mkdirSync(frames, { recursive: true })
const browser = await launch()
const n = Math.ceil(total * FPS)

async function open() {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  await page.addInitScript((d) => { window.__DATA = d }, data)
  page.on('pageerror', (e) => console.error('PAGE ERROR', e.message))
  await page.goto(BASE + '/', { waitUntil: 'load' })
  await page.evaluate(() => window.ready)
  return page
}

if (ONLY != null) {
  const page = await open()
  const tt = +ONLY
  await page.evaluate((x) => window.seek(x), tt)
  await page.screenshot({ path: path.join(OUT, `test-${ONLY}.png`) })
  await browser.close(); server.close()
  console.log('image de contrôle :', path.join(OUT, `test-${ONLY}.png`), '— durée totale', total.toFixed(1), 's')
  process.exit(0)
}

const WORKERS = 4
let next = 0
async function worker() {
  const page = await open()
  for (;;) {
    const i = next++
    if (i >= n) break
    await page.evaluate((x) => window.seek(x), i / FPS)
    await page.screenshot({ path: path.join(frames, `f${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 })
    if (i % 250 === 0) console.log(`image ${i}/${n}`)
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker))
await browser.close(); server.close()

/* ── assemblage ── */
const video = path.join(OUT, AUDIO ? 'attestation-tva.mp4' : 'attestation-tva-apercu-muet.mp4')
const ff = ['-y', '-framerate', String(FPS), '-i', path.join(frames, 'f%05d.jpg')]
if (AUDIO) {
  // une piste par scène, calée sur son début, silence ailleurs
  const parts = scenes.filter((s) => s.mp3)
  parts.forEach((s) => ff.push('-i', s.mp3))
  const fc = parts.map((s, k) => `[${k + 1}:a]adelay=${Math.round((s.t0 + 0.2) * 1000)}|${Math.round((s.t0 + 0.2) * 1000)}[a${k}]`).join(';') +
    ';' + parts.map((_, k) => `[a${k}]`).join('') + `amix=inputs=${parts.length}:normalize=0[aout]`
  ff.push('-filter_complex', fc, '-map', '0:v', '-map', '[aout]', '-c:a', 'aac', '-b:a', '192k')
}
ff.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', '-t', total.toFixed(2), video)
const r = spawnSync('ffmpeg', ff, { stdio: 'inherit' })
if (r.status !== 0) process.exit(r.status)

/* ── sous-titres et minutage ── */
const ts = (x) => { const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), s = x % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0').replace('.', ',')}` }
let srt = ''
script.scenes.forEach((s, i) => {
  const sc = scenes[i]
  const phrases = s.voix.match(/[^.!?]+[.!?»]*/g).map((x) => x.trim()).filter(Boolean)
  const tot = phrases.reduce((a, p) => a + p.length, 0)
  let cur = sc.t0 + 0.2
  phrases.forEach((p) => {
    const d = (sc.dur - 1) * (p.length / tot)
    srt += `${srt.split('\n\n').length}\n${ts(cur)} --> ${ts(cur + d)}\n${p}\n\n`
    cur += d
  })
})
fs.writeFileSync(path.join(OUT, 'sous-titres.srt'), srt)
fs.writeFileSync(path.join(OUT, 'minutage.json'), JSON.stringify(scenes, null, 2))
console.log('terminé :', video, `(${total.toFixed(1)} s)`)
