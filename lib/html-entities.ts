/**
 * Décodage des entités HTML (nommées courantes et numériques), partagé par le
 * sommaire et la FAQ des articles du blog.
 */
const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", thinsp: " ", narrownbsp: " ",
  laquo: "«", raquo: "»", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", hellip: "…", ndash: "–", mdash: "—",
  euro: "€", deg: "°", times: "×", middot: "·", bull: "•", copy: "©", reg: "®", trade: "™", sect: "§", para: "¶",
  eacute: "é", egrave: "è", ecirc: "ê", euml: "ë", agrave: "à", acirc: "â", auml: "ä", ccedil: "ç",
  icirc: "î", iuml: "ï", ocirc: "ô", ouml: "ö", ugrave: "ù", ucirc: "û", uuml: "ü", yuml: "ÿ", oelig: "œ", aelig: "æ",
  Eacute: "É", Egrave: "È", Ecirc: "Ê", Agrave: "À", Acirc: "Â", Ccedil: "Ç", Icirc: "Î", Ocirc: "Ô", Ucirc: "Û", OElig: "Œ",
}

/** Décode les entités HTML (nommées courantes et numériques). */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m
    }
    return NAMED[code] ?? m
  })
}
