// Voix ElevenLabs (v4) + minutage de chaque mot, pour scene2.html.
//   XI_API_KEY=sk_… node gen-voice-xi.mjs <dossier-de-sortie> [voice_id] [model_id]
// Écrit scene-NN.mp3 et scene-NN.words.json ({ text, words:[{t,d,w}] }), comme gen-voice-edge.py.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const HERE = path.dirname(fileURLToPath(import.meta.url))
const [out, voice = 'ecxPjiGTvAfpGEams6ec', model = 'eleven_v4'] = process.argv.slice(2)
const key = process.env.XI_API_KEY
if (!key || !out) { console.error('usage : XI_API_KEY=… node gen-voice-xi.mjs <dossier> [voice] [model]'); process.exit(1) }
fs.mkdirSync(out, { recursive: true })
const script = JSON.parse(fs.readFileSync(path.join(HERE, 'script.v2.fr.json'), 'utf8'))
// Prononciation : un mot écrit → un mot dit (même nombre de mots, pour que les sous-titres restent justes)
const SAY = [['1301-SD', 'mille trois cent un S D'], ['1300-SD', 'mille trois cents S D'], ['5,5 %', 'cinq virgule cinq pour cent'], ['10 %', 'dix pour cent'], ['20 %', 'vingt pour cent'],
  ['qonforme.fr/modele', 'qonforme point fr, slash modèle'], ['Word', 'Ouorde'], ['Excel', 'Èxel'], ['PDF', 'Pé-Dé-Èf']]
const SHOW = { 'Ouorde': 'Word', 'Èxel': 'Excel', 'Pé-Dé-Èf': 'PDF' }
const spoken = (t) => SAY.reduce((a, [x, y]) => a.split(x).join(y), t)
for (const [i, s] of script.scenes.entries()) {
  const base = path.join(out, `scene-${String(i + 1).padStart(2, '0')}`)
  const text = spoken(s.voix)
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: model, language_code: 'fr', voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true } }),
  })
  if (!r.ok) { console.error(s.id, r.status, (await r.text()).slice(0, 400)); process.exit(1) }
  const j = await r.json()
  fs.writeFileSync(base + '.mp3', Buffer.from(j.audio_base64, 'base64'))
  const a = j.alignment || j.normalized_alignment
  const ch = a.characters, st = a.character_start_times_seconds, en = a.character_end_times_seconds
  const words = []; let cur = null
  ch.forEach((c, k) => {
    if (/\s/.test(c)) { if (cur) { words.push(cur); cur = null } return }
    if (!cur) cur = { t: st[k], d: 0, w: '' }
    cur.w += c; cur.d = en[k] - cur.t
  })
  if (cur) words.push(cur)
  words.forEach((w) => { w.w = w.w.replace(/^[«"(]+|[.,;:?!»")]+$/g, ''); w.w = SHOW[w.w] || w.w })
  fs.writeFileSync(base + '.words.json', JSON.stringify({ text, words }))
  console.log('ok', base, words.length, 'mots', (a.character_end_times_seconds.at(-1)).toFixed(1) + ' s')
}
