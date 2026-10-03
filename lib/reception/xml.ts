/**
 * Lecteur XML minimal et sûr, pour les factures reçues (CII, UBL 2.1).
 *
 * Un fichier déposé par l'utilisateur ou transmis par une plateforme est une
 * entrée hostile. Ce lecteur, écrit sans dépendance, ne sait volontairement
 * presque rien faire :
 * - aucune déclaration de type de document (<!DOCTYPE …>, <!ENTITY …>) : refusée
 *   d'emblée, ce qui ferme les entités externes (XXE) et les entités en cascade
 *   (« billion laughs ») ;
 * - seules les cinq entités prédéfinies (&amp; &lt; &gt; &quot; &apos;) et les
 *   références numériques sont lues ; toute autre entité est une erreur ;
 * - aucune ressource extérieure n'est jamais chargée (pas de schéma, pas d'inclusion) ;
 * - lecture itérative (pas de récursion) bornée en taille, profondeur, nombre
 *   d'éléments et d'attributs.
 *
 * Il rend un arbre d'éléments (nom local, espace de noms, attributs, texte
 * direct, enfants), suffisant pour lire une facture : le texte mêlé d'éléments
 * n'existe pas dans ces formats.
 *
 * Fonction pure, sans API propre à Node : elle tourne aussi dans le navigateur
 * (import de démonstration).
 */

export interface XmlElement {
  /** Nom local, sans préfixe (« CrossIndustryInvoice »). */
  name: string
  /** URI de l'espace de noms, "" s'il n'y en a pas. */
  ns: string
  /** Attributs par nom local (préfixe retiré), hors déclarations xmlns. */
  attrs: Record<string, string>
  children: XmlElement[]
  /** Texte direct de l'élément (sections CDATA comprises), entités résolues. */
  text: string
}

export type XmlErrorCode = "doctype" | "entity" | "too_large" | "too_deep" | "too_many_nodes" | "malformed"

export class XmlError extends Error {
  constructor(public readonly code: XmlErrorCode, message: string) {
    super(message)
    this.name = "XmlError"
  }
}

export interface XmlLimits {
  /** Longueur maximale du texte XML, en caractères. */
  maxChars: number
  /** Profondeur maximale d'imbrication. */
  maxDepth: number
  /** Nombre maximal d'éléments. */
  maxNodes: number
  /** Nombre maximal d'attributs par élément. */
  maxAttrs: number
}

/** Une facture de 2 000 lignes tient largement dans ces bornes. */
export const XML_LIMITS: XmlLimits = {
  maxChars: 5_000_000,
  maxDepth: 64,
  maxNodes: 200_000,
  maxAttrs: 64,
}

const PREDEFINED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'" }

/** Résout les entités prédéfinies et les références numériques ; refuse toute autre entité. */
function decodeEntities(raw: string): string {
  if (raw.indexOf("&") === -1) return raw
  let out = ""
  let i = 0
  while (i < raw.length) {
    const amp = raw.indexOf("&", i)
    if (amp === -1) { out += raw.slice(i); break }
    out += raw.slice(i, amp)
    const semi = raw.indexOf(";", amp + 1)
    if (semi === -1 || semi - amp > 12) throw new XmlError("malformed", "XML invalide : caractère « & » isolé.")
    const ref = raw.slice(amp + 1, semi)
    if (ref.startsWith("#")) {
      const hex = ref[1] === "x" || ref[1] === "X"
      const digits = hex ? ref.slice(2) : ref.slice(1)
      if (!(hex ? /^[0-9a-fA-F]{1,6}$/ : /^[0-9]{1,7}$/).test(digits)) {
        throw new XmlError("malformed", "XML invalide : référence de caractère incorrecte.")
      }
      const cp = parseInt(digits, hex ? 16 : 10)
      // Caractères admis par XML 1.0 (pas de NUL, pas de demi-codets isolés)
      const allowed = cp === 0x9 || cp === 0xa || cp === 0xd || (cp >= 0x20 && cp <= 0xd7ff) || (cp >= 0xe000 && cp <= 0xfffd) || (cp >= 0x10000 && cp <= 0x10ffff)
      if (!allowed) throw new XmlError("malformed", "XML invalide : caractère interdit.")
      out += String.fromCodePoint(cp)
    } else if (Object.prototype.hasOwnProperty.call(PREDEFINED, ref)) {
      out += PREDEFINED[ref]
    } else {
      throw new XmlError("entity", `XML refusé : entité « &${ref.slice(0, 20)}; » non prédéfinie.`)
    }
    i = semi + 1
  }
  return out
}

const WS = /\s/

function isNameChar(c: string): boolean {
  return !(WS.test(c) || c === "/" || c === ">" || c === "<" || c === "=" || c === "\"" || c === "'")
}

interface Frame {
  el: XmlElement
  qname: string
  nsMap: Record<string, string>
}

const XML_NS = "http://www.w3.org/XML/1998/namespace"

/**
 * Lit un document XML et rend son élément racine.
 * Lève une XmlError (code et message en français) si le document est mal
 * formé, hostile ou hors des bornes.
 */
export function parseXml(input: string, limits: XmlLimits = XML_LIMITS): XmlElement {
  if (input.length > limits.maxChars) throw new XmlError("too_large", "Fichier XML trop volumineux.")
  const s = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input

  const stack: Frame[] = []
  let root: XmlElement | null = null
  let nodes = 0
  let i = 0

  const pushText = (t: string) => {
    if (!t) return
    const top = stack[stack.length - 1]
    if (top) top.el.text += t
    else if (/\S/.test(t)) throw new XmlError("malformed", "XML invalide : texte hors de l'élément racine.")
  }

  while (i < s.length) {
    const lt = s.indexOf("<", i)
    if (lt === -1) { pushText(decodeEntities(s.slice(i))); break }
    if (lt > i) pushText(decodeEntities(s.slice(i, lt)))

    if (s.startsWith("<!--", lt)) {
      const end = s.indexOf("-->", lt + 4)
      if (end === -1) throw new XmlError("malformed", "XML invalide : commentaire non fermé.")
      i = end + 3
      continue
    }
    if (s.startsWith("<![CDATA[", lt)) {
      if (stack.length === 0) throw new XmlError("malformed", "XML invalide : section CDATA hors de l'élément racine.")
      const end = s.indexOf("]]>", lt + 9)
      if (end === -1) throw new XmlError("malformed", "XML invalide : section CDATA non fermée.")
      stack[stack.length - 1].el.text += s.slice(lt + 9, end)
      i = end + 3
      continue
    }
    if (s.startsWith("<!", lt)) {
      // <!DOCTYPE, <!ENTITY, <!ELEMENT… : jamais dans une facture, porte des attaques XXE
      throw new XmlError("doctype", "XML refusé : les déclarations de type de document (DOCTYPE, ENTITY) sont interdites.")
    }
    if (s.startsWith("<?", lt)) {
      const end = s.indexOf("?>", lt + 2)
      if (end === -1) throw new XmlError("malformed", "XML invalide : instruction non fermée.")
      i = end + 2
      continue
    }
    if (s.startsWith("</", lt)) {
      const end = s.indexOf(">", lt + 2)
      if (end === -1) throw new XmlError("malformed", "XML invalide : balise fermante incomplète.")
      const qname = s.slice(lt + 2, end).trim()
      const top = stack.pop()
      if (!top || top.qname !== qname) throw new XmlError("malformed", "XML invalide : balises mal imbriquées.")
      i = end + 1
      continue
    }

    // Balise ouvrante
    if (root && stack.length === 0) throw new XmlError("malformed", "XML invalide : plusieurs éléments racines.")
    let j = lt + 1
    while (j < s.length && isNameChar(s[j])) j++
    const qname = s.slice(lt + 1, j)
    if (!qname) throw new XmlError("malformed", "XML invalide : nom de balise vide.")

    const rawAttrs: [string, string][] = []
    let selfClosing = false
    for (;;) {
      while (j < s.length && WS.test(s[j])) j++
      if (j >= s.length) throw new XmlError("malformed", "XML invalide : balise non fermée.")
      if (s[j] === ">") { j++; break }
      if (s[j] === "/" && s[j + 1] === ">") { selfClosing = true; j += 2; break }
      const nameStart = j
      while (j < s.length && isNameChar(s[j])) j++
      const aname = s.slice(nameStart, j)
      if (!aname) throw new XmlError("malformed", "XML invalide : attribut mal formé.")
      while (j < s.length && WS.test(s[j])) j++
      if (s[j] !== "=") throw new XmlError("malformed", "XML invalide : attribut sans valeur.")
      j++
      while (j < s.length && WS.test(s[j])) j++
      const quote = s[j]
      if (quote !== "\"" && quote !== "'") throw new XmlError("malformed", "XML invalide : valeur d'attribut sans guillemets.")
      const close = s.indexOf(quote, j + 1)
      if (close === -1) throw new XmlError("malformed", "XML invalide : valeur d'attribut non fermée.")
      const rawValue = s.slice(j + 1, close)
      if (rawValue.indexOf("<") !== -1) throw new XmlError("malformed", "XML invalide : « < » dans un attribut.")
      rawAttrs.push([aname, decodeEntities(rawValue)])
      if (rawAttrs.length > limits.maxAttrs) throw new XmlError("too_many_nodes", "XML refusé : trop d'attributs sur un élément.")
      j = close + 1
    }

    // Espaces de noms
    const parentNs = stack.length ? stack[stack.length - 1].nsMap : { xml: XML_NS }
    let nsMap = parentNs
    const attrs: Record<string, string> = {}
    for (const [aname, value] of rawAttrs) {
      if (aname === "xmlns" || aname.startsWith("xmlns:")) {
        if (nsMap === parentNs) nsMap = { ...parentNs }
        nsMap[aname === "xmlns" ? "" : aname.slice(6)] = value
      }
    }
    for (const [aname, value] of rawAttrs) {
      if (aname === "xmlns" || aname.startsWith("xmlns:")) continue
      const colon = aname.indexOf(":")
      attrs[colon === -1 ? aname : aname.slice(colon + 1)] = value
    }
    const colon = qname.indexOf(":")
    const prefix = colon === -1 ? "" : qname.slice(0, colon)
    const el: XmlElement = {
      name: colon === -1 ? qname : qname.slice(colon + 1),
      ns: nsMap[prefix] ?? "",
      attrs,
      children: [],
      text: "",
    }

    if (++nodes > limits.maxNodes) throw new XmlError("too_many_nodes", "XML refusé : trop d'éléments.")
    if (stack.length) stack[stack.length - 1].el.children.push(el)
    else root = el
    if (!selfClosing) {
      if (stack.length + 1 > limits.maxDepth) throw new XmlError("too_deep", "XML refusé : imbrication trop profonde.")
      stack.push({ el, qname, nsMap })
    }
    i = j
  }

  if (stack.length) throw new XmlError("malformed", "XML invalide : document tronqué.")
  if (!root) throw new XmlError("malformed", "XML invalide : aucun élément.")
  return root
}

/* ------------------------------------------------------------------ */
/* Lecture de l'arbre                                                   */
/* ------------------------------------------------------------------ */

/** Premier enfant direct portant ce nom local. */
export function child(el: XmlElement | null | undefined, name: string): XmlElement | undefined {
  return el?.children.find((c) => c.name === name)
}

/** Enfants directs portant ce nom local. */
export function childrenOf(el: XmlElement | null | undefined, name: string): XmlElement[] {
  return el ? el.children.filter((c) => c.name === name) : []
}

/** Descend de premier enfant en premier enfant : at(el, "A", "B") = el/A/B. */
export function at(el: XmlElement | null | undefined, ...names: string[]): XmlElement | undefined {
  let cur = el ?? undefined
  for (const n of names) {
    cur = child(cur, n)
    if (!cur) return undefined
  }
  return cur
}

/** Tous les éléments au bout du chemin, en suivant chaque branche. */
export function all(el: XmlElement | null | undefined, ...names: string[]): XmlElement[] {
  let level: XmlElement[] = el ? [el] : []
  for (const n of names) level = level.flatMap((e) => childrenOf(e, n))
  return level
}

/** Texte nettoyé d'un élément, ou null s'il est absent ou vide. */
export function textOf(el: XmlElement | null | undefined): string | null {
  const t = el?.text.trim()
  return t ? t : null
}

/** Texte au bout d'un chemin. */
export function textAt(el: XmlElement | null | undefined, ...names: string[]): string | null {
  return textOf(at(el, ...names))
}
