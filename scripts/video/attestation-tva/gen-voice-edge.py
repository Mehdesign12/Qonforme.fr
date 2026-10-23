"""Voix française d'homme (Microsoft Neural, sans clé) + minutage de chaque mot.
   python3 gen-voice-edge.py <dossier-de-sortie> [voix] [vitesse]
   Écrit scene-NN.mp3 et scene-NN.words.json ([{t, d, w}], en secondes)."""
import asyncio, json, sys, os, re, ssl
import certifi
ca = os.environ.get('SSL_CERT_FILE')
if ca: certifi.where = lambda: ca          # proxy d'entreprise : son autorité de certification
import edge_tts

here = os.path.dirname(os.path.abspath(__file__))
out = sys.argv[1]; voice = sys.argv[2] if len(sys.argv) > 2 else 'fr-FR-RemyMultilingualNeural'
rate = sys.argv[3] if len(sys.argv) > 3 else '+8%'
os.makedirs(out, exist_ok=True)
script = json.load(open(os.path.join(here, 'script.v2.fr.json'), encoding='utf8'))

def spoken(t):
    for a, b in [('1301-SD','mille trois cent un S D'),('1300-SD','mille trois cents S D'),('5,5 %','cinq virgule cinq pour cent'),
                 ('10 %','dix pour cent'),('20 %','vingt pour cent'),('qonforme.fr/modele','qonforme point fr, slash modèle')]:
        t = t.replace(a, b)
    return t

async def one(i, s):
    text = spoken(s['voix'])
    com = edge_tts.Communicate(text, voice, rate=rate, boundary='WordBoundary')
    words, audio = [], bytearray()
    async for ev in com.stream():
        if ev['type'] == 'audio': audio += ev['data']
        elif ev['type'] == 'WordBoundary':
            words.append({'t': ev['offset'] / 1e7, 'd': ev['duration'] / 1e7, 'w': ev['text']})
    base = os.path.join(out, f'scene-{i+1:02d}')
    open(base + '.mp3', 'wb').write(audio)
    json.dump({'text': text, 'words': words}, open(base + '.words.json', 'w', encoding='utf8'), ensure_ascii=False)
    print('ok', base, len(words), 'mots')

async def main():
    for i, s in enumerate(script['scenes']): await one(i, s)
asyncio.run(main())
