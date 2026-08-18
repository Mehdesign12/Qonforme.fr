/**
 * Génère les assets PWA/iOS à partir du logo source.
 *
 *   node scripts/generate-pwa-assets.mjs
 *
 * Produit :
 *   - public/icons/maskable-{192,512}.png   → icônes maskable Android (safe zone respectée)
 *   - public/splash/apple-splash-*.png      → écrans de démarrage iOS (portrait + paysage)
 *   - lib/pwa/apple-splash-screens.ts       → média-queries associées, consommées par <AppleSplashScreens />
 *
 * Le fond reprend --background (#F8FAFC) : l'app force `defaultTheme="light"`
 * avec `enableSystem={false}`, donc un seul jeu de splash clairs suffit.
 */
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_ICON = path.join(ROOT, 'public/web-app-manifest-512x512.png')
// Même visuel en 1024 natif et sans canal alpha — source de l'icône native.
const SOURCE_ICON_HD = path.join(ROOT, 'public/favicon-source-1024.png')
const BACKGROUND = { r: 0xf8, g: 0xfa, b: 0xfc, alpha: 1 } // #F8FAFC — var(--background)

/**
 * Le PNG source a ses coins arrondis *aplatis en noir opaque* (alpha = 255 partout).
 * Composé tel quel sur un fond clair, il afficherait quatre coins noirs.
 *
 * On reconstruit donc le canal alpha à partir de la luminance : tous les pixels
 * quasi noirs de l'image sont dans les coins (vérifié : 4 496 pixels, aucun ailleurs),
 * le « Q » bleu montant à 235 et le fond à 245. La rampe 8 → 40 lisse l'anticrénelage,
 * et les pixels concernés reçoivent la couleur du fond du logo pour éviter un halo sombre.
 */
async function buildTransparentLogo() {
  const { data, info } = await sharp(SOURCE_ICON)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  const out = Buffer.alloc(width * height * 4)

  for (let i = 0, o = 0; i < data.length; i += channels, o += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const luminance = Math.max(r, g, b)
    const alpha = Math.max(0, Math.min(255, Math.round(((luminance - 8) / 32) * 255)))

    if (alpha === 255) {
      out[o] = r
      out[o + 1] = g
      out[o + 2] = b
    } else {
      // Teinte du fond du logo (#F5F4F2) : le liseré translucide reste clair.
      out[o] = 245
      out[o + 1] = 244
      out[o + 2] = 242
    }
    out[o + 3] = alpha
  }

  return sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer()
}

/** Buffer du logo à coins transparents, calculé une seule fois. */
let logoPromise
const getLogo = () => (logoPromise ??= buildTransparentLogo())

/** Écrans iOS : [largeur CSS, hauteur CSS, device-pixel-ratio, libellé]. */
const IOS_DEVICES = [
  [320, 480, 2, 'iPhone 4/4s'],
  [320, 568, 2, 'iPhone 5/5s/SE 1'],
  [375, 667, 2, 'iPhone 6/7/8/SE 2-3'],
  [414, 736, 3, 'iPhone 6+/7+/8+'],
  [375, 812, 3, 'iPhone X/XS/11 Pro/12 mini'],
  [414, 896, 2, 'iPhone XR/11'],
  [414, 896, 3, 'iPhone XS Max/11 Pro Max'],
  [360, 780, 3, 'iPhone 12/13 mini'],
  [390, 844, 3, 'iPhone 12/13/14'],
  [428, 926, 3, 'iPhone 12/13 Pro Max/14 Plus'],
  [393, 852, 3, 'iPhone 14 Pro/15/15 Pro/16'],
  [430, 932, 3, 'iPhone 14 Pro Max/15 Plus/16 Plus'],
  [402, 874, 3, 'iPhone 16 Pro'],
  [440, 956, 3, 'iPhone 16 Pro Max'],
  [768, 1024, 2, 'iPad 9.7"'],
  [810, 1080, 2, 'iPad 10.2"'],
  [820, 1180, 2, 'iPad Air 10.9"'],
  [834, 1112, 2, 'iPad Pro 10.5"'],
  [834, 1194, 2, 'iPad Pro 11"'],
  [1024, 1366, 2, 'iPad Pro 12.9"'],
]

/** Compose un splash : fond plat + logo centré. */
async function renderSplash(pxWidth, pxHeight, outFile) {
  // Le logo occupe ~28 % du plus petit côté — proportion Apple sur les Launch Screens.
  const logoSize = Math.round(Math.min(pxWidth, pxHeight) * 0.28)
  const logo = await sharp(await getLogo())
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()

  await sharp({
    create: { width: pxWidth, height: pxHeight, channels: 4, background: BACKGROUND },
  })
    .composite([{ input: logo, gravity: 'center' }])
    // Palette 8 bits : le splash n'a que deux aplats + le dégradé du logo → fichiers légers.
    .png({ palette: true, quality: 90, compressionLevel: 9 })
    .toFile(outFile)
}

/** Icône maskable : le logo est réduit à 72 % pour tenir dans la safe zone circulaire. */
async function renderMaskable(size, outFile) {
  const inner = Math.round(size * 0.72)
  const logo = await sharp(await getLogo()).resize(inner, inner, { fit: 'contain' }).toBuffer()

  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(outFile)
}


/**
 * Icône de l'app native : carré plein, sans transparence.
 *
 * iOS applique lui-même le masque arrondi et refuse les icônes à canal alpha.
 * On rebouche donc les coins noirs de la source en prolongeant, sur chaque
 * ligne, la couleur du premier pixel clair rencontré — le fond du logo étant un
 * dégradé doux, la reprise est invisible.
 *
 * Le travail se fait sur `favicon-source-1024.png` : même visuel, mais en 1024
 * natif et déjà sans canal alpha. Passer par le logo à coins transparents
 * obligerait à tester l'alpha *après* redimensionnement, où l'interpolation de
 * sharp brouille la frontière et fait ressortir le noir des coins.
 */
async function renderOpaqueIcon(size, outFile) {
  const { data, info } = await sharp(SOURCE_ICON_HD)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height } = info
  const out = Buffer.alloc(width * height * 3)
  /*
   * Seuil haut, volontairement : la transition noir → fond est anticrénelée et
   * traverse toutes les valeurs intermédiaires. Un seuil bas (40) faisait
   * passer un pixel encore sombre pour le début du fond, qui était alors étalé
   * sur tout le coin. Le fond vaut 245 et le bleu du « Q » plafonne à 235 :
   * 220 ne peut désigner que du contenu réel.
   */
  const isLight = (i) => Math.max(data[i], data[i + 1], data[i + 2]) >= 220
  // Deux pixels de marge pour écarter le résidu d'anticrénelage.
  const MARGIN = 2

  for (let y = 0; y < height; y++) {
    const row = y * width

    let first = 0
    while (first < width && !isLight((row + first) * 3)) first++
    let last = width - 1
    while (last >= 0 && !isLight((row + last) * 3)) last--

    const sampleFirst = Math.min(first + MARGIN, last)
    const sampleLast = Math.max(last - MARGIN, first)

    // Ligne entièrement sombre : impossible sur cette source, mais on ne veut
    // pas écrire de pixels non initialisés si elle changeait un jour.
    if (first >= width) {
      out.fill(245, row * 3, (row + width) * 3)
      continue
    }

    for (let x = 0; x < width; x++) {
      const src = x < first ? sampleFirst : x > last ? sampleLast : x
      const i = (row + src) * 3
      const o = (row + x) * 3
      out[o] = data[i]
      out[o + 1] = data[i + 1]
      out[o + 2] = data[i + 2]
    }
  }

  await sharp(out, { raw: { width, height, channels: 3 } })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(outFile)
}

/** Écran de démarrage natif : carré, le cadrage étant fait par Capacitor. */
async function renderNativeSplash(size, background, outFile) {
  const logoSize = Math.round(size * 0.22)
  const logo = await sharp(await getLogo()).resize(logoSize, logoSize).toBuffer()

  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: logo, gravity: 'center' }])
    .png({ palette: true, compressionLevel: 9 })
    .toFile(outFile)
}

async function main() {
  await mkdir(path.join(ROOT, 'public/splash'), { recursive: true })
  await mkdir(path.join(ROOT, 'public/icons'), { recursive: true })
  await mkdir(path.join(ROOT, 'lib/pwa'), { recursive: true })

  await renderMaskable(192, path.join(ROOT, 'public/icons/maskable-192.png'))
  await renderMaskable(512, path.join(ROOT, 'public/icons/maskable-512.png'))
  console.log('✓ icônes maskable 192 + 512')

  const entries = []

  for (const [cssW, cssH, dpr, label] of IOS_DEVICES) {
    for (const orientation of ['portrait', 'landscape']) {
      const isPortrait = orientation === 'portrait'
      const pxW = Math.round((isPortrait ? cssW : cssH) * dpr)
      const pxH = Math.round((isPortrait ? cssH : cssW) * dpr)
      const href = `/splash/apple-splash-${pxW}-${pxH}.png`

      await renderSplash(pxW, pxH, path.join(ROOT, 'public', href))

      entries.push({
        href,
        media:
          `screen and (device-width: ${cssW}px) and (device-height: ${cssH}px) ` +
          `and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: ${orientation})`,
        label: `${label} — ${orientation}`,
      })
    }
  }
  console.log(`✓ ${entries.length} écrans de démarrage iOS`)

  const ts = `/**
 * FICHIER GÉNÉRÉ — ne pas éditer à la main.
 * Source : scripts/generate-pwa-assets.mjs
 *
 * iOS n'utilise pas les icônes du manifest pour l'écran de démarrage : il lui faut
 * un <link rel="apple-touch-startup-image"> par combinaison taille/densité/orientation.
 */
export type AppleSplashScreen = {
  /** Chemin du PNG dans /public. */
  href: string
  /** Média-query ciblant exactement un modèle et une orientation. */
  media: string
  /** Modèle correspondant — documentaire uniquement. */
  label: string
}

export const APPLE_SPLASH_SCREENS: AppleSplashScreen[] = ${JSON.stringify(entries, null, 2)}
`
  await writeFile(path.join(ROOT, 'lib/pwa/apple-splash-screens.ts'), ts, 'utf8')
  console.log('✓ lib/pwa/apple-splash-screens.ts')

  /*
   * Sources consommées par `npx @capacitor/assets generate`, qui en dérive
   * l'AppIcon et le LaunchScreen du projet Xcode. Sans elles, l'app native
   * afficherait l'icône Capacitor par défaut.
   */
  await mkdir(path.join(ROOT, 'assets'), { recursive: true })
  await renderOpaqueIcon(1024, path.join(ROOT, 'assets/icon.png'))
  await renderNativeSplash(2732, BACKGROUND, path.join(ROOT, 'assets/splash.png'))
  await renderNativeSplash(
    2732,
    { r: 0x0b, g: 0x16, b: 0x28, alpha: 1 }, // --background en thème sombre
    path.join(ROOT, 'assets/splash-dark.png'),
  )
  console.log('✓ assets/ (icône + écrans de démarrage natifs)')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
