/**
 * Email du résumé hebdomadaire SEO (Paramètres › Rapports), envoyé à
 * l'adresse de l'administrateur (ADMIN_EMAIL) au nom de Qonforme.
 *
 * Même style que les autres emails de Qonforme (bandeau bleu, corps blanc,
 * pied gris, styles en ligne pour Gmail, Outlook et Apple Mail), vouvoiement,
 * signé « Qonforme ». Aucun chiffre inventé : une valeur absente s'écrit « — »,
 * une section sans données le dit en une phrase. Les concurrents n'y figurent
 * jamais (usage interne de l'onglet SEO seulement).
 *
 * Module pur : la page Paramètres › Rapports s'en sert aussi dans le
 * navigateur pour l'aperçu en direct. Tout texte venu de la base est échappé.
 */
import { deltaCount, deltaPosition, deltaRate, fmtCount, fmtDay, fmtPosition, fmtRate, NBSP, type Delta } from "@/lib/seo/format"
import { SEVERITY } from "@/lib/seo/types"
import { SITE_ORIGIN } from "@/lib/seo/site"
import { parisDayOf } from "@/lib/utils/paris-date"
import {
  DIGEST_SECTION_LABELS,
  type DigestSectionKey,
  type DigestSections,
  type SeoDigest,
} from "@/lib/seo/reports/types"

const ACCENT = "#2563EB"
const INK = "#0F172A"
const TEXT = "#475569"
const MUTED = "#64748B"
const LINE = "#E2E8F0"
const MONO = "'DM Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"

const PILL: Record<string, { bg: string; fg: string }> = {
  danger: { bg: "#FEF2F2", fg: "#B91C1C" },
  warn: { bg: "#FFF7E6", fg: "#B45309" },
  neutral: { bg: "#F1F4F8", fg: "#475569" },
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

const e = escapeHtml

export interface RenderDigestOptions {
  /** Origine des liens vers l'admin (https://qonforme.fr). */
  baseUrl: string
  /** Sections à rendre (par défaut celles du résumé). */
  sections?: DigestSections
  /** Aperçu envoyé à la demande depuis Paramètres › Rapports. */
  preview?: boolean
}

export interface RenderedDigest {
  subject: string
  preheader: string
  html: string
}

function plural(n: number, one: string, many: string): string {
  return `${fmtCount(n)}${NBSP}${Math.abs(n) >= 2 ? many : one}`
}

/** Première lettre en minuscule, sauf sigle (« LCP », « H1 »). */
function lowerFirst(text: string): string {
  if (text.length < 2) return text
  const [a, b] = [text[0], text[1]]
  return b === b.toLowerCase() && b !== b.toUpperCase() ? a.toLowerCase() + text.slice(1) : text
}

function unavailable(digest: SeoDigest, key: DigestSectionKey): boolean {
  const loaded = key === "kpis" ? digest.kpis : key === "pages" ? digest.findings : key === "articles" ? digest.articles : digest.geo
  return digest.unavailable.includes(key) || loaded === undefined
}

/**
 * Plage courte de jours (AAAA-MM-JJ) : « du 3 au 9 oct. », « du 28 sept. au
 * 4 oct. », « le 9 oct. ».
 */
export function dayRange(from: string, to: string): string {
  if (from === to) return `le ${fmtDay(to)}`
  const sameMonth = from.slice(0, 7) === to.slice(0, 7)
  const day = Number(from.slice(8, 10))
  const start = sameMonth ? (day === 1 ? "1er" : String(day)) : fmtDay(from)
  return `du ${start} au ${fmtDay(to)}`
}

/**
 * Objet : « SEO : 1 clic du 3 au 9 oct., page bien classée sans clic sur
 * /modele ». Les clics sont datés par leur vraie plage (les derniers jours
 * enregistrés de Search Console, en retard de 2 à 3 jours sur l'envoi).
 * Sans chiffre lisible, l'objet ne cite pas de chiffre.
 */
export function digestSubject(digest: SeoDigest, sections: DigestSections = digest.sections): string {
  const parts: string[] = []
  if (sections.kpis && digest.kpis) {
    const { range, current } = digest.kpis
    parts.push(`${plural(current.clicks, "clic", "clics")} ${dayRange(range.from, range.to)}`)
  }
  if (sections.pages && digest.findings) {
    const first = digest.findings.top[0]
    if (first) {
      const title = lowerFirst(first.title.trim())
      const short = title.length > 70 ? `${title.slice(0, 69).trimEnd()}…` : title
      parts.push(first.path ? `${short} sur ${first.path}` : short)
    } else {
      parts.push("aucun constat ouvert")
    }
  }
  if (parts.length === 0) return `SEO${NBSP}: résumé de la semaine ${dayRange(digest.week.from, digest.week.to)}`
  return `SEO${NBSP}: ${parts.join(", ")}`
}

/* ------------------------------------------------------------------ */
/* Briques                                                             */
/* ------------------------------------------------------------------ */

function h2(text: string): string {
  return `<h2 style="margin:28px 0 10px;font-size:16px;line-height:1.35;font-weight:700;color:${INK};">${e(text)}</h2>`
}

function p(html: string, extra = ""): string {
  return `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:${TEXT};${extra}">${html}</p>`
}

function link(label: string, href: string): string {
  return `<a href="${e(href)}" style="color:${ACCENT};font-weight:600;text-decoration:none;">${e(label)}&nbsp;→</a>`
}

function pill(label: string, tone: string): string {
  const c = PILL[tone] ?? PILL.neutral
  return `<span style="display:inline-block;padding:3px 9px;border-radius:999px;background-color:${c.bg};color:${c.fg};font-size:12px;font-weight:600;line-height:1.4;white-space:nowrap;">${e(label)}</span>`
}

function deltaText(delta: Delta | null): string {
  if (!delta || delta.trend === "none") return "—"
  return delta.text
}

function kpiCell(label: string, value: string, delta: string): string {
  return `<td width="50%" style="padding:12px 14px;border:1px solid ${LINE};vertical-align:top;">
    <p style="margin:0;font-size:12px;color:${MUTED};">${e(label)}</p>
    <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:${INK};">${e(value)}</p>
    <p style="margin:2px 0 0;font-size:12px;color:${MUTED};">${e(delta)}</p>
  </td>`
}

function unavailableLine(): string {
  return p("Données indisponibles pour le moment&nbsp;: la lecture a échoué au moment du résumé.")
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function kpisSection(digest: SeoDigest, baseUrl: string): string {
  let body: string
  if (unavailable(digest, "kpis")) {
    body = unavailableLine()
  } else if (!digest.kpis) {
    body = p("Aucune donnée Search Console enregistrée pour le moment.")
  } else {
    const { range, current, previous } = digest.kpis
    const sentence =
      current.impressions > 0
        ? `Du ${fmtDay(range.from)} au ${fmtDay(range.to, true)}, qonforme.fr a obtenu ${plural(current.clicks, "clic", "clics")} pour ${plural(current.impressions, "impression", "impressions")}` +
          `, avec un taux de clic de ${fmtRate(current.ctr)} et une position moyenne de ${fmtPosition(current.position)}.`
        : `Du ${fmtDay(range.from)} au ${fmtDay(range.to, true)}, qonforme.fr n'a obtenu aucune impression dans Google.`
    const compare = digest.kpis.partial
      ? `Données partielles&nbsp;: Search Console n&#39;est enregistré que depuis le ${e(fmtDay(range.from, true))}, pas de comparaison.`
      : previous
        ? "Comparé aux 7 jours précédents."
        : "Pas de comparaison&nbsp;: les 7 jours précédents ne sont pas encore enregistrés."
    const clicks = previous ? deltaCount(current.clicks, previous.clicks) : null
    const impressions = previous ? deltaCount(current.impressions, previous.impressions) : null
    const ctr = previous ? deltaRate(current.ctr, previous.ctr) : null
    const position = previous ? deltaPosition(current.position, previous.position) : null
    body = `${p(e(sentence))}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;margin:4px 0 8px;">
      <tr>${kpiCell("Clics", fmtCount(current.clicks), deltaText(clicks))}${kpiCell("Impressions", fmtCount(current.impressions), deltaText(impressions))}</tr>
      <tr>${kpiCell("Taux de clic", fmtRate(current.ctr), deltaText(ctr))}${kpiCell("Position moyenne", fmtPosition(current.position), deltaText(position))}</tr>
    </table>
    ${p(compare, `font-size:12px;color:${MUTED};`)}`
  }
  return `${h2(DIGEST_SECTION_LABELS.kpis.label)}${body}${p(link("Ouvrir la performance", `${baseUrl}/admin/seo/performance`))}`
}

function pagesSection(digest: SeoDigest, baseUrl: string): string {
  let body: string
  if (unavailable(digest, "pages")) {
    body = unavailableLine()
  } else if (!digest.findings || digest.findings.top.length === 0) {
    body = p("Aucun constat ouvert&nbsp;: aucune page ne demande d'action en priorité.")
  } else {
    const rows = digest.findings.top
      .map((f, i) => {
        const sev = SEVERITY[f.severity] ?? SEVERITY.low
        const border = i === digest.findings!.top.length - 1 ? "" : `border-bottom:1px solid ${LINE};`
        return `<tr>
        <td style="padding:12px 0;${border}vertical-align:top;">
          <p style="margin:0;font-size:14px;font-weight:600;color:${INK};">${e(f.title)}</p>
          <p style="margin:2px 0 0;font-family:${MONO};font-size:12px;color:${MUTED};">${e(f.path)}</p>
          ${f.explanation ? `<p style="margin:4px 0 0;font-size:13px;line-height:1.5;color:${TEXT};">${e(f.explanation)}</p>` : ""}
        </td>
        <td style="padding:12px 0 12px 12px;${border}vertical-align:top;text-align:right;width:90px;">${pill(sev.label, sev.tone)}</td>
      </tr>`
      })
      .join("")
    const more =
      digest.findings.openCount > digest.findings.top.length
        ? p(`${plural(digest.findings.openCount, "constat ouvert", "constats ouverts")} en tout.`, `font-size:12px;color:${MUTED};`)
        : ""
    body = `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;margin:0 0 8px;">${rows}</table>${more}`
  }
  return `${h2(DIGEST_SECTION_LABELS.pages.label)}${body}${p(link("Ouvrir les actions SEO", `${baseUrl}/admin/seo/actions`))}`
}

function articlesSection(digest: SeoDigest, baseUrl: string): string {
  let body: string
  if (unavailable(digest, "articles")) {
    body = unavailableLine()
  } else if (!digest.articles || digest.articles.length === 0) {
    body = p(e(`Aucun article publié ${dayRange(digest.week.from, digest.week.to)}.`))
  } else {
    body = `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;margin:0 0 8px;">${digest.articles
      .map(
        (a) => `<tr><td style="padding:8px 0;border-bottom:1px solid ${LINE};">
          <a href="${e(`${SITE_ORIGIN}/blog/${encodeURIComponent(a.slug)}`)}" style="font-size:14px;font-weight:600;color:${INK};text-decoration:none;">${e(a.title)}</a>
          <p style="margin:2px 0 0;font-size:12px;color:${MUTED};">Publié le ${e(fmtDay(parisDayOf(a.publishedAt), true))}</p>
        </td></tr>`,
      )
      .join("")}</table>`
  }
  return `${h2(DIGEST_SECTION_LABELS.articles.label)}${body}${p(link("Ouvrir les articles", `${baseUrl}/admin/seo/articles`))}`
}

function geoSection(digest: SeoDigest, baseUrl: string): string {
  let body: string
  if (unavailable(digest, "geo")) {
    body = unavailableLine()
  } else if (!digest.geo) {
    body = p("Aucun relevé terminé pour le moment.")
  } else {
    const g = digest.geo
    const when = fmtDay(parisDayOf(g.at), true)
    const intro = g.imported ? `Relevé importé (${when})` : `Dernier relevé du ${when}`
    const engines = g.engines.length
      ? `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:4px 0 8px;">
        <tr>
          <th scope="col" align="left" style="padding:6px 0;font-size:12px;font-weight:600;color:${MUTED};border-bottom:1px solid ${LINE};">Moteur</th>
          <th scope="col" align="right" style="padding:6px 0;font-size:12px;font-weight:600;color:${MUTED};border-bottom:1px solid ${LINE};">Mentions</th>
          <th scope="col" align="right" style="padding:6px 0;font-size:12px;font-weight:600;color:${MUTED};border-bottom:1px solid ${LINE};">Citations</th>
        </tr>
        ${g.engines
          .map(
            (en) => `<tr>
          <td style="padding:6px 0;font-size:13px;color:${INK};border-bottom:1px solid ${LINE};">${e(en.label)}</td>
          <td align="right" style="padding:6px 0;font-size:13px;color:${INK};border-bottom:1px solid ${LINE};">${e(fmtRate(en.mentionRate))}</td>
          <td align="right" style="padding:6px 0;font-size:13px;color:${INK};border-bottom:1px solid ${LINE};">${e(fmtRate(en.citationRate))}</td>
        </tr>`,
          )
          .join("")}
      </table>`
      : ""
    body = `${p(
      `${e(intro)}&nbsp;: Qonforme est mentionné dans ${e(fmtRate(g.mentionRate))} des réponses et qonforme.fr cité comme source dans ${e(fmtRate(g.citationRate))}.`,
    )}${engines}`
  }
  return `${h2(DIGEST_SECTION_LABELS.geo.label)}${body}${p(link("Ouvrir la visibilité IA", `${baseUrl}/admin/seo/visibilite-ia`))}`
}

/* ------------------------------------------------------------------ */
/* Email                                                               */
/* ------------------------------------------------------------------ */

export function renderSeoDigest(digest: SeoDigest, opts: RenderDigestOptions): RenderedDigest {
  const baseUrl = opts.baseUrl.replace(/\/+$/, "")
  const sections = opts.sections ?? digest.sections
  const subject = `${opts.preview ? "Aperçu · " : ""}${digestSubject(digest, sections)}`
  const preheader = `Le point SEO de qonforme.fr du ${fmtDay(digest.week.from)} au ${fmtDay(digest.week.to, true)}.`

  const blocks: string[] = []
  if (sections.kpis) blocks.push(kpisSection(digest, baseUrl))
  if (sections.pages) blocks.push(pagesSection(digest, baseUrl))
  if (sections.articles) blocks.push(articlesSection(digest, baseUrl))
  if (sections.geo) blocks.push(geoSection(digest, baseUrl))
  const content = blocks.length
    ? blocks.join("")
    : p("Aucune section n'est cochée dans Paramètres › Rapports&nbsp;: ce résumé ne contient rien.")

  const settingsUrl = `${baseUrl}/admin/seo/parametres/rapports`
  const reason = opts.preview
    ? "Aperçu envoyé à votre demande depuis Paramètres › Rapports."
    : "Vous recevez ce résumé parce qu'il est activé dans Paramètres › Rapports."

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${e(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <span style="display:none;font-size:1px;color:#F1F5F9;max-height:0;max-width:0;opacity:0;overflow:hidden;">${e(preheader)}</span>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#F1F5F9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;">
          <tr>
            <td style="background-color:${ACCENT};border-radius:12px 12px 0 0;padding:24px 36px;">
              <p style="margin:0;color:#FFFFFF;font-size:20px;font-weight:800;letter-spacing:-0.3px;">Qonforme</p>
              <p style="margin:2px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Résumé SEO hebdomadaire de qonforme.fr</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#FFFFFF;padding:32px 36px;border-left:1px solid ${LINE};border-right:1px solid ${LINE};">
              <h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;font-weight:700;color:${INK};letter-spacing:-0.3px;">Votre semaine SEO</h1>
              ${p(`Voici le point sur qonforme.fr du ${e(fmtDay(digest.week.from))} au ${e(fmtDay(digest.week.to, true))}.`)}
              ${content}
              ${p("Qonforme", `margin:28px 0 0;font-weight:600;color:${INK};`)}
            </td>
          </tr>
          <tr>
            <td style="background-color:#F8FAFC;border:1px solid ${LINE};border-top:none;border-radius:0 0 12px 12px;padding:18px 36px;text-align:center;">
              <p style="margin:0;font-size:12px;line-height:1.55;color:${MUTED};">Envoyé par Qonforme. ${e(reason)}</p>
              <p style="margin:8px 0 0;font-size:12px;"><a href="${e(settingsUrl)}" style="color:${MUTED};text-decoration:underline;">Régler ou arrêter le résumé</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, preheader, html }
}
