// Refait les captures de l'accueil (public/landing/ecrans/<série>/*.webp) depuis les pages
// de la démo, pour que les maquettes montrent toujours l'interface du moment.
//
//  - ordinateur : 1280 × 800 à 1,5 (fichiers de 1 920 × 1 200) ;
//  - téléphone : iPhone 15, 393 × 852 à 2 (786 × 1 704), avec ses zones sûres
//    simulées (59 points en haut, 34 en bas). L'application les respecte
//    (env(safe-area-inset-*)) : la page se place sous l'îlot et au-dessus de
//    l'indicateur d'accueil, et components/landing/devices.tsx affiche la capture
//    entière, sans rien rogner, avec sa barre d'état dessinée dans la zone vide.
//
// L'habillage propre à la démo (badges « Démo », encart « Mode démo », liens
// « Retour à l'accueil » et « Créer mon compte ») est masqué : l'accueil montre
// le produit. Les données restent celles de lib/demo/data.ts.
//
// Usage : le site lancé en local (npx next dev -p 3100), puis
//   node scripts/capture-landing-screens.mjs <dossier> [http://localhost:3100]
// avec un dossier NOUVEAU (v3, v4…) sous public/landing/ecrans, puis ECRANS dans
// components/landing/devices.tsx et suppression de l'ancien dossier : l'optimisation
// d'images de Vercel garde une image tant que son adresse ne change pas.
// Playwright est pris dans le projet s'il y est, sinon dans les modules globaux
// (npm root -g) ; navigateur : CHROMIUM_PATH, sinon celui de Playwright.
import { createRequire } from "node:module"
import { execSync } from "node:child_process"
import { join } from "node:path"
import { mkdirSync } from "node:fs"
import sharp from "sharp"

const [VERSION, BASE = "http://localhost:3100"] = process.argv.slice(2)
if (!VERSION) throw new Error("Dossier de la série attendu, par exemple : node scripts/capture-landing-screens.mjs v3")
const OUT = `public/landing/ecrans/${VERSION}`
mkdirSync(OUT, { recursive: true })

function loadPlaywright() {
  const local = createRequire(import.meta.url)
  try {
    return local("playwright")
  } catch {
    const root = execSync("npm root -g").toString().trim()
    return createRequire(join(root, "noop.js"))("playwright")
  }
}
const { chromium } = loadPlaywright()

const DESKTOP = [
  ["tableau-de-bord", "/demo"],
  ["devis", "/demo/quotes/d-2026-035"],
  ["facture", "/demo/invoices/f-2026-0142"],
  ["factures", "/demo/invoices"],
]
const MOBILE = [
  ["mobile-tableau-de-bord", "/demo"],
  ["mobile-devis", "/demo/quotes/d-2026-035"],
  ["mobile-facture", "/demo/invoices/f-2026-0142"],
  ["mobile-factures", "/demo/invoices"],
]
const ANALYTICS = /(posthog|facebook|sentry|google-analytics|googletagmanager|doubleclick)\./

async function shoot(ctx, name, path, safeArea) {
  const page = await ctx.newPage()
  await page.route((url) => ANALYTICS.test(url.hostname), (route) => route.abort())
  if (safeArea) {
    const cdp = await ctx.newCDPSession(page)
    await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 59, bottom: 34, left: 0, right: 0 } })
  }
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 180_000 })
  // Polices prêtes et images visibles chargées (les images différées hors écran ne viennent jamais)
  await page.evaluate(async () => {
    await document.fonts.ready
    const visible = [...document.images].filter((img) => {
      const r = img.getBoundingClientRect()
      return r.bottom > 0 && r.top < innerHeight && r.width > 0
    })
    const loads = Promise.all(visible.map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r }))))
    await Promise.race([loads, new Promise((r) => setTimeout(r, 8000))])
  })
  await page.waitForTimeout(1500)
  // Masqués, jamais retirés : React garde la main sur ces nœuds
  await page.evaluate(() => {
    const hide = (el) => el.style.setProperty("display", "none", "important")
    for (const el of document.querySelectorAll(".q-tag")) if (el.textContent.trim() === "Démo") hide(el)
    for (const el of document.querySelectorAll('[class*="q-warn-bg"]')) if (el.textContent.includes("Mode démo")) hide(el)
    for (const a of document.querySelectorAll("a")) {
      const t = a.textContent.trim()
      if (t === "Retour à l'accueil" || t.startsWith("Créer mon compte")) hide(a)
    }
  })
  await page.waitForTimeout(300)
  const broken = await page.evaluate(() =>
    [...document.images]
      .filter((i) => { const r = i.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && i.complete && i.naturalWidth === 0 })
      .map((i) => i.src),
  )
  if (broken.length) throw new Error(`${name} : images cassées ${broken.join(", ")}`)
  const png = await page.screenshot()
  await sharp(png).webp({ quality: 82, effort: 6 }).toFile(`${OUT}/${name}.webp`)
  console.log(`${OUT}/${name}.webp`)
  await page.close()
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
try {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5, colorScheme: "light" })
  for (const [name, path] of DESKTOP) await shoot(desktop, name, path, false)
  await desktop.close()
  const phone = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: "light" })
  for (const [name, path] of MOBILE) await shoot(phone, name, path, true)
  await phone.close()
} finally {
  await browser.close()
}
