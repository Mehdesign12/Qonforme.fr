// Génère scene-01.mp3 … scene-08.mp3 avec ElevenLabs (clé dans XI_API_KEY, jamais dans le dépôt).
//   XI_API_KEY=sk_… node gen-voice.mjs <dossier-de-sortie> [voice_id] [model_id]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const HERE = path.dirname(fileURLToPath(import.meta.url))
const [out, voice = 'ecxPjiGTvAfpGEams6ec', model = 'eleven_v4'] = process.argv.slice(2)
const key = process.env.XI_API_KEY
if (!key || !out) { console.error('usage : XI_API_KEY=… node gen-voice.mjs <dossier> [voice] [model]'); process.exit(1) }
fs.mkdirSync(out, { recursive: true })
// Écriture phonétique : ce que la voix doit dire
const spoken = (t) => t
  .replace(/1301-SD/g, 'mille trois cent un S D').replace(/1300-SD/g, 'mille trois cents S D')
  .replace(/5,5 %/g, 'cinq virgule cinq pour cent').replace(/10 %/g, 'dix pour cent').replace(/20 %/g, 'vingt pour cent')
  .replace(/qonforme\.fr\/modele/g, 'qonforme point fr, slash modèle')
const { scenes } = JSON.parse(fs.readFileSync(path.join(HERE, 'script.fr.json'), 'utf8'))
for (const [i, s] of scenes.entries()) {
  const file = path.join(out, `scene-${String(i + 1).padStart(2, '0')}.mp3`)
  if (fs.existsSync(file) && fs.statSync(file).size > 2000) { console.log('déjà fait', file); continue }
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: spoken(s.voix), model_id: model, language_code: 'fr', voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true } }),
  })
  if (!r.ok) { console.error(s.id, r.status, (await r.text()).slice(0, 400)); process.exit(1) }
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()))
  console.log('ok', file)
}
