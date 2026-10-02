/**
 * Génère les photos d'ambiance de l'accueil et remplit lib/landing/photos.ts.
 *
 *   OPENAI_API_KEY=… node scripts/generate-landing-photos.mjs            (gpt-image-1)
 *   GEMINI_API_KEY=… node scripts/generate-landing-photos.mjs            (Gemini, facturation Google requise)
 *   node scripts/generate-landing-photos.mjs chantier finDeJournee       (seulement ces photos)
 *
 * La clé se lit dans l'environnement, jamais dans un fichier du dépôt.
 * Derrière un proxy, Node 22 a besoin de NODE_USE_ENV_PROXY=1.
 *
 * Produit public/landing/photos/<clé>.webp (1600 px de large en paysage,
 * 1000 px en portrait, qualité 78) et remplace l'entrée null correspondante du
 * manifeste. Relire chaque image avant de committer : aucun texte, logo ni
 * écran lisible, et des personnes jamais présentées comme des clients.
 */
import sharp from 'sharp'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'public/landing/photos')
const MANIFEST = path.join(ROOT, 'lib/landing/photos.ts')

const STYLE =
  'Photorealistic editorial documentary photograph, shot on a full-frame camera with a 35mm lens, natural light, ' +
  'true-to-life skin texture, subtle film grain, calm and authentic, not staged, not stock-photo smiling. ' +
  'Set in France. Muted, natural color palette with clean whites and a few cool blue accents.'
const RULES =
  'STRICT RULES: absolutely no text, letters, numbers, logos, brand names or watermarks anywhere. ' +
  'Clothing and vans are plain, without any print or branding. Any phone, tablet or laptop screen is either facing away ' +
  'from the camera or shows only a soft blurred glow, never readable content. No collage, no borders, single photograph.'

/** Clés identiques à LandingPhotoKey (lib/landing/photos.ts). */
const SHOTS = {
  chantier: {
    ratio: [16, 9],
    alt: "Un plâtrier dans un appartement en rénovation, son téléphone à la main",
    scene:
      'Wide shot inside a bright apartment under renovation in a Haussmann-style building: a French plasterer in his mid-thirties, ' +
      'in grey work trousers and a plain navy sweatshirt, stands near a tall window between fresh plasterboard walls, looking at his ' +
      'smartphone held in one hand (screen facing him, not visible). Dust in the window light, buckets and a stepladder in the ' +
      'background, lots of negative space on the left side of the frame.',
  },
  nouvelInstalle: {
    ratio: [4, 5],
    alt: "Une électricienne devant son utilitaire, le matin, avant un chantier",
    scene:
      'A French woman electrician in her late twenties, hair tied back, plain dark work jacket, standing at the open side door of ' +
      'her small white work van parked on a quiet suburban street in the morning. Neat tool cases inside the van. She glances at ' +
      'her phone with a confident, focused expression. Soft morning light, shallow depth of field.',
  },
  sansLogiciel: {
    ratio: [4, 5],
    alt: "Un peintre en bâtiment à sa table de cuisine, un carnet de chiffres ouvert",
    scene:
      'An experienced French painter-decorator in his early fifties with grey stubble, in paint-speckled white work clothes, ' +
      'sitting at a wooden kitchen table at home in the early evening. A worn paper notebook full of handwritten figures lies open ' +
      'next to a closed laptop and a coffee mug. He rubs his temple thoughtfully. Warm lamp light, cosy and real.',
  },
  entrepriseGrandit: {
    ratio: [4, 5],
    alt: "Une cheffe de chantier échange avec deux maçons sur un chantier",
    scene:
      'A small French building team on a residential construction site at golden hour: a woman site foreman in her forties wearing ' +
      'a hard hat and a plain hi-vis vest discusses with two masons, one of them holding a tablet (screen facing away from the ' +
      'camera). Concrete block walls and scaffolding behind them. Candid moment, warm low sun.',
  },
  finDeJournee: {
    ratio: [16, 9],
    alt: "Un couvreur ferme son utilitaire devant une maison en pierre, à la tombée du jour",
    scene:
      'End of the working day: a French roofer in his thirties closing the rear doors of his plain white van in front of a renovated ' +
      'stone house at dusk, blue hour sky, warm light from the house windows, calm satisfied atmosphere. The subject is on the right ' +
      'third of the frame, the left two thirds are darker and quieter, suitable for overlaying text.',
  },
}

const prompt = (shot) => `${shot.scene}\n\n${STYLE}\n\n${RULES}`

async function generateOpenAI(shot, key) {
  const landscape = shot.ratio[0] > shot.ratio[1]
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1',
      prompt: prompt(shot),
      size: landscape ? '1536x1024' : '1024x1536',
      quality: 'high',
      n: 1,
    }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`OpenAI ${res.status} : ${json.error?.message ?? JSON.stringify(json).slice(0, 300)}`)
  return Buffer.from(json.data[0].b64_json, 'base64')
}

async function generateGemini(shot, key) {
  const model = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-3-pro-image'
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt(shot) }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio: shot.ratio.join(':'), imageSize: '2K' },
      },
    }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`Gemini ${res.status} : ${json.error?.message ?? JSON.stringify(json).slice(0, 300)}`)
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData ?? p.inline_data)
  if (!part) throw new Error(`Gemini : aucune image dans la réponse (${JSON.stringify(json).slice(0, 300)})`)
  return Buffer.from((part.inlineData ?? part.inline_data).data, 'base64')
}

async function main() {
  const openaiKey = process.env.OPENAI_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY
  if (!openaiKey && !geminiKey) {
    console.error('Définir OPENAI_API_KEY ou GEMINI_API_KEY dans l’environnement.')
    process.exit(1)
  }
  const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SHOTS)
  const unknown = keys.filter((k) => !SHOTS[k])
  if (unknown.length) {
    console.error(`Clés inconnues : ${unknown.join(', ')}. Disponibles : ${Object.keys(SHOTS).join(', ')}`)
    process.exit(1)
  }

  await mkdir(OUT_DIR, { recursive: true })
  let manifest = await readFile(MANIFEST, 'utf8')

  for (const key of keys) {
    const shot = SHOTS[key]
    try {
      const raw = openaiKey ? await generateOpenAI(shot, openaiKey) : await generateGemini(shot, geminiKey)
      const landscape = shot.ratio[0] > shot.ratio[1]
      const width = landscape ? 1600 : 1000
      const height = Math.round((width * shot.ratio[1]) / shot.ratio[0])
      const file = path.join(OUT_DIR, `${key}.webp`)
      const info = await sharp(raw).resize(width, height, { fit: 'cover', position: 'attention' }).webp({ quality: 78 }).toFile(file)

      const entry = `  ${key}: { src: "/landing/photos/${key}.webp", width: ${info.width}, height: ${info.height}, alt: ${JSON.stringify(shot.alt)} },`
      const line = new RegExp(`^  ${key}: .*,$`, 'm')
      manifest = manifest.replace(line, entry)
      console.log(`${key} : ${info.width}×${info.height}, ${Math.round(info.size / 1024)} Ko`)
    } catch (err) {
      console.error(`${key} : échec — ${err.message}`)
    }
  }

  await writeFile(MANIFEST, manifest)
  console.log('lib/landing/photos.ts mis à jour. Relire les images avant de committer.')
}

main()
