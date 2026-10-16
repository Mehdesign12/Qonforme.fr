// @vitest-environment happy-dom
/**
 * Coque de l'éditeur d'articles (components/admin/blog/shell/model.ts et
 * hooks.ts) : heure proposée d'une programmation, jour du calendrier, état
 * initial, détection des modifications, requête d'enregistrement (le texte
 * n'est jamais renvoyé tel quel), état après enregistrement, réponse 409,
 * brouillon local, liens interceptés à la sortie de la page.
 */
import { describe, expect, it } from "vitest"
import {
  buildSaveRequest,
  changedFields,
  dayLabel,
  defaultScheduleSlot,
  describeFields,
  draftOfPost,
  draftToOffer,
  isDirty,
  issuesOf,
  localDraftKey,
  metaAfterSave,
  metaOfPost,
  newDraft,
  normalSlug,
  parseLocalDraft,
  programmedDay,
  publicationMovedSince,
  publicationOfPost,
  relativeDay,
  restoreDraft,
  saveActionLabel,
  serializeLocalDraft,
  statusOfMeta,
  successMessage,
  tabOfTarget,
  targetOfError,
  type ArticleDraft,
  type EditorPost,
  type SavedMeta,
} from "@/components/admin/blog/shell/model"
import { internalHrefOf } from "@/components/admin/blog/shell/hooks"

/** 16 octobre 2026 (heure d'été de Paris : UTC+2). */
const at = (parisTime: string, day = "2026-10-16") => new Date(`${day}T${parisTime}:00+02:00`)
const NOW = at("19:22")

const POST: EditorPost = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "auto-entrepreneur-batiment",
  title: "Auto-entrepreneur du bâtiment : le guide",
  excerpt: "Qualification, assurance décennale et devis.",
  content: "## Le statut\n\nUn texte.\n",
  cover_url: "https://exemple.supabase.co/storage/v1/object/public/blog-covers/a.jpg",
  cover_alt: "Un maçon au travail",
  is_published: true,
  published_at: "2026-10-07T19:19:00.000Z",
  scheduled_at: null,
  created_at: "2026-10-07T19:18:00.000Z",
  updated_at: "2026-10-09T08:00:00.000Z",
  seo_title: null,
  seo_description: null,
  target_keyword: "auto entrepreneur bâtiment",
  review_status: null,
  held_reason: null,
}

const draft = (over: Partial<ArticleDraft> = {}): ArticleDraft => ({ ...draftOfPost(POST, "08:00", NOW), ...over })

/* ------------------------------------------------------------------ */
/* Heure proposée et jour du calendrier                                */
/* ------------------------------------------------------------------ */

describe("defaultScheduleSlot", () => {
  it("garde l'heure des Préférences pour un jour à venir", () => {
    expect(defaultScheduleSlot("2026-10-22", "08:00", NOW)).toEqual({ day: "2026-10-22", time: "08:00", adjusted: "none", preferred: "08:00" })
  })

  it("garde l'heure des Préférences aujourd'hui si elle n'est pas passée", () => {
    expect(defaultScheduleSlot("2026-10-16", "08:00", at("06:30"))).toMatchObject({ day: "2026-10-16", time: "08:00", adjusted: "none" })
  })

  it("propose la prochaine heure du jour, à au moins 10 minutes, quand celle des Préférences est passée", () => {
    // 19:22 + 10 min = 19:32 : 19:30 est trop proche, 19:45 convient
    expect(defaultScheduleSlot("2026-10-16", "08:00", NOW)).toEqual({ day: "2026-10-16", time: "19:45", adjusted: "later_today", preferred: "08:00" })
    expect(defaultScheduleSlot("2026-10-16", "08:00", at("19:20"))).toMatchObject({ time: "19:30", adjusted: "later_today" })
    // L'heure des Préférences trop proche (moins de 10 minutes) compte comme passée
    expect(defaultScheduleSlot("2026-10-16", "19:30", at("19:25"))).toMatchObject({ time: "19:45", adjusted: "later_today" })
  })

  it("passe au lendemain quand il n'y a plus d'heure possible aujourd'hui", () => {
    expect(defaultScheduleSlot("2026-10-16", "08:00", at("22:40"))).toEqual({ day: "2026-10-17", time: "08:00", adjusted: "next_day", preferred: "08:00" })
  })

  it("lit un jour passé ou illisible comme aujourd'hui, une heure illisible comme 08:00", () => {
    expect(defaultScheduleSlot("2026-10-01", "08:00", at("06:00"))).toMatchObject({ day: "2026-10-16", time: "08:00", adjusted: "none" })
    expect(defaultScheduleSlot(null, "8h", at("06:00"))).toMatchObject({ day: "2026-10-16", time: "08:00", preferred: "08:00" })
  })
})

describe("programmedDay", () => {
  it("accepte aujourd'hui et les jours à venir (heure de Paris), jusqu'à un an", () => {
    expect(programmedDay("2026-10-16", NOW)).toBe("2026-10-16")
    expect(programmedDay("2026-10-22", NOW)).toBe("2026-10-22")
    expect(programmedDay(["2026-10-22", "2026-10-23"], NOW)).toBe("2026-10-22")
    expect(programmedDay("2027-10-16", NOW)).toBe("2027-10-16")
  })

  it("refuse un jour passé, inexistant, trop lointain ou mal écrit", () => {
    expect(programmedDay("2026-10-15", NOW)).toBeNull()
    expect(programmedDay("2026-02-30", NOW)).toBeNull()
    expect(programmedDay("2027-10-17", NOW)).toBeNull()
    expect(programmedDay("22/10/2026", NOW)).toBeNull()
    expect(programmedDay(undefined, NOW)).toBeNull()
  })

  it("suit le jour de Paris, pas celui du serveur (UTC)", () => {
    // 16 octobre à 23:30 à Paris = 21:30 UTC : « aujourd'hui » reste le 16
    expect(programmedDay("2026-10-16", at("23:30"))).toBe("2026-10-16")
    // 17 octobre à 00:30 à Paris = 16 octobre 22:30 UTC : le 16 est passé
    expect(programmedDay("2026-10-16", at("00:30", "2026-10-17"))).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* État initial                                                        */
/* ------------------------------------------------------------------ */

describe("état initial", () => {
  it("lit la publication d'un article enregistré", () => {
    expect(publicationOfPost({ is_published: true, scheduled_at: null }, "09:15", NOW)).toEqual({ mode: "publish", day: "2026-10-17", time: "09:15" })
    expect(publicationOfPost({ is_published: false, scheduled_at: "2026-10-21T06:00:00.000Z" }, "08:00", NOW)).toEqual({ mode: "schedule", day: "2026-10-21", time: "08:00" })
    expect(publicationOfPost({ is_published: false, scheduled_at: null }, "08:00", NOW)).toMatchObject({ mode: "draft" })
  })

  it("montre une date programmée déjà passée (article retenu) comme un brouillon", () => {
    expect(publicationOfPost({ is_published: false, scheduled_at: "2026-10-10T06:00:00.000Z" }, "08:00", NOW)).toEqual({ mode: "draft", day: "2026-10-10", time: "08:00" })
  })

  it("article « À relire » avec une date à venir : brouillon (la tâche ne le publiera pas), reprogrammable sur le même créneau", () => {
    const held: EditorPost = { ...POST, is_published: false, published_at: null, scheduled_at: "2026-10-22T06:00:00.000Z", review_status: "to_review" }
    const saved = draftOfPost(held, "08:00", NOW)
    expect(saved.publication).toEqual({ mode: "draft", day: "2026-10-22", time: "08:00" })
    expect(statusOfMeta(metaOfPost(held))).toBe("to_review")
    // Texte corrigé seulement : la publication n'est pas renvoyée, l'article reste « À relire »
    const textOnly = buildSaveRequest({ mode: "edit", id: held.id, current: { ...saved, content: "## Le statut\n\nTexte relu.\n" }, saved, meta: metaOfPost(held), now: NOW })
    expect(textOnly).toMatchObject({ kind: "request", body: { content: "## Le statut\n\nTexte relu.\n" }, change: "none" })
    // « Programmé » sur le même jour et la même heure : la date part, le serveur retire la décision de relecture
    const confirm = buildSaveRequest({ mode: "edit", id: held.id, current: { ...saved, publication: { mode: "schedule", day: "2026-10-22", time: "08:00" } }, saved, meta: metaOfPost(held), now: NOW })
    expect(confirm).toMatchObject({ kind: "request", change: "schedule", body: { scheduled_at: "2026-10-22T06:00:00.000Z" } })
  })

  it("reprend tous les champs de l'article, valeurs absentes comprises", () => {
    const d = draftOfPost({ ...POST, excerpt: null, cover_url: undefined, target_keyword: "  " }, "08:00", NOW)
    expect(d).toMatchObject({ title: POST.title, excerpt: "", coverUrl: "", coverAlt: "Un maçon au travail", seoTitle: "", keyword: null })
  })

  it("ouvre un nouvel article en brouillon, ou programmé au jour du calendrier", () => {
    expect(newDraft(null, "08:00", NOW)).toMatchObject({ draft: { title: "", content: "", publication: { mode: "draft" } }, slot: null })
    const fromCalendar = newDraft("2026-10-22", "08:00", NOW)
    expect(fromCalendar.draft.publication).toEqual({ mode: "schedule", day: "2026-10-22", time: "08:00" })
    expect(fromCalendar.slot?.adjusted).toBe("none")
    expect(newDraft("2026-10-16", "08:00", NOW).draft.publication).toEqual({ mode: "schedule", day: "2026-10-16", time: "19:45" })
  })

  it("donne le statut affiché de l'article enregistré", () => {
    expect(statusOfMeta(metaOfPost(POST))).toBe("published")
    expect(statusOfMeta(metaOfPost({ ...POST, is_published: false, scheduled_at: "2026-10-21T06:00:00.000Z" }))).toBe("scheduled")
    expect(statusOfMeta(metaOfPost({ ...POST, is_published: false, review_status: "to_review", scheduled_at: "2026-10-21T06:00:00.000Z" }))).toBe("to_review")
    expect(statusOfMeta(metaOfPost(null))).toBe("draft")
  })
})

/* ------------------------------------------------------------------ */
/* Modifications                                                       */
/* ------------------------------------------------------------------ */

describe("détection des modifications", () => {
  it("ne voit rien à l'ouverture", () => {
    expect(changedFields(draft(), draft())).toEqual([])
    expect(isDirty(draft(), draft())).toBe(false)
  })

  it("compare les valeurs telles que le serveur les enregistre", () => {
    const saved = draft()
    expect(isDirty(draft({ title: `  ${POST.title} ` }), saved)).toBe(false)
    expect(isDirty(draft({ content: `${POST.content}\n\n` }), saved)).toBe(false)
    expect(isDirty(draft({ slug: "-auto-entrepreneur--batiment-" }), saved)).toBe(false)
    expect(isDirty(draft({ keyword: "Auto Entrepreneur  Bâtiment" }), saved)).toBe(false)
    expect(isDirty(draft({ coverAlt: "Un  maçon au\ntravail" }), saved)).toBe(false)
  })

  it("liste les champs changés dans l'ordre de la page", () => {
    const changed = draft({ slug: "nouvelle-adresse", title: "Nouveau titre", content: "Autre texte", keyword: null })
    expect(changedFields(changed, draft())).toEqual(["title", "content", "keyword", "slug"])
  })

  it("ne compte le jour et l'heure que pour une programmation", () => {
    const saved = draft({ publication: { mode: "draft", day: "2026-10-17", time: "08:00" } })
    expect(isDirty(draft({ publication: { mode: "draft", day: "2026-10-30", time: "10:00" } }), saved)).toBe(false)
    const scheduled = draft({ publication: { mode: "schedule", day: "2026-10-21", time: "08:00" } })
    expect(changedFields(draft({ publication: { mode: "schedule", day: "2026-10-21", time: "08:15" } }), scheduled)).toEqual(["publication"])
  })

  it("décrit les champs d'un brouillon local", () => {
    expect(describeFields(["title", "content", "coverUrl", "coverAlt", "slug"])).toBe("titre, texte, couverture et adresse")
    expect(describeFields(["content"])).toBe("texte")
    expect(describeFields([])).toBe("")
  })

  it("met l'adresse au propre comme le serveur", () => {
    expect(normalSlug("  -mon--article- ")).toBe("mon-article")
  })
})

/* ------------------------------------------------------------------ */
/* Requête d'enregistrement                                            */
/* ------------------------------------------------------------------ */

const META = metaOfPost(POST)
const ID = POST.id

describe("buildSaveRequest — modification", () => {
  it("n'envoie rien quand rien n'a changé", () => {
    expect(buildSaveRequest({ mode: "edit", id: ID, current: draft(), saved: draft(), meta: META, now: NOW })).toEqual({ kind: "nothing" })
  })

  it("n'envoie que les champs changés, jamais le texte s'il est intact", () => {
    const req = buildSaveRequest({ mode: "edit", id: ID, current: draft({ seoTitle: " Titre pour Google ", keyword: "Devis Maçonnerie" }), saved: draft(), meta: META, now: NOW })
    expect(req).toMatchObject({ kind: "request", method: "PATCH", url: `/api/admin/blog/${ID}`, change: "none" })
    if (req.kind !== "request") throw new Error()
    expect(req.body).toEqual({ seo_title: "Titre pour Google", target_keyword: "devis maçonnerie" })
    expect(req.body).not.toHaveProperty("content")
  })

  it("envoie le texte tel quel quand il a changé", () => {
    const content = "## Le statut\n\nUn texte **revu**.\n"
    const req = buildSaveRequest({ mode: "edit", id: ID, current: draft({ content }), saved: draft(), meta: META, now: NOW })
    expect(req.kind === "request" && req.body).toEqual({ content })
  })

  it("retire le mot-clé, la couverture et son texte alternatif", () => {
    const req = buildSaveRequest({ mode: "edit", id: ID, current: draft({ keyword: null, coverUrl: "", coverAlt: "" }), saved: draft(), meta: META, now: NOW })
    expect(req.kind === "request" && req.body).toEqual({ cover_url: "", cover_alt: null, target_keyword: null })
  })

  it("publie, programme, retire du blog ou retire la programmation", () => {
    const draftSaved = draft({ publication: { mode: "draft", day: "2026-10-17", time: "08:00" } })
    const draftMeta: SavedMeta = { ...META, isPublished: false, publishedAt: null }

    const publish = buildSaveRequest({ mode: "edit", id: ID, current: draft({ publication: { mode: "publish", day: "2026-10-17", time: "08:00" } }), saved: draftSaved, meta: draftMeta, now: NOW })
    expect(publish).toMatchObject({ change: "publish", body: { is_published: true } })

    const schedule = buildSaveRequest({ mode: "edit", id: ID, current: draft({ publication: { mode: "schedule", day: "2026-10-22", time: "08:00" } }), saved: draftSaved, meta: draftMeta, now: NOW })
    expect(schedule).toMatchObject({ change: "schedule", scheduledAt: "2026-10-22T06:00:00.000Z", body: { scheduled_at: "2026-10-22T06:00:00.000Z" } })

    const unpublish = buildSaveRequest({ mode: "edit", id: ID, current: draft({ publication: { mode: "draft", day: "2026-10-17", time: "08:00" } }), saved: draft(), meta: META, now: NOW })
    expect(unpublish).toMatchObject({ change: "unpublish", body: { is_published: false, scheduled_at: null } })

    const scheduledSaved = draft({ publication: { mode: "schedule", day: "2026-10-21", time: "08:00" } })
    const unschedule = buildSaveRequest({
      mode: "edit",
      id: ID,
      current: draft({ publication: { mode: "draft", day: "2026-10-21", time: "08:00" } }),
      saved: scheduledSaved,
      meta: { ...draftMeta, scheduledAt: "2026-10-21T06:00:00.000Z" },
      now: NOW,
    })
    expect(unschedule).toMatchObject({ change: "unschedule", body: { is_published: false, scheduled_at: null } })
  })

  it("garde une programmation inchangée sans la renvoyer (même passée entre-temps)", () => {
    const scheduled = draft({ publication: { mode: "schedule", day: "2026-10-16", time: "19:30" } })
    const req = buildSaveRequest({ mode: "edit", id: ID, current: { ...scheduled, title: "Autre titre" }, saved: scheduled, meta: META, now: at("19:40") })
    expect(req.kind === "request" && req.body).toEqual({ title: "Autre titre" })
  })

  it("refuse avant l'envoi ce que le serveur refuserait, avec le champ à montrer", () => {
    const check = (over: Partial<ArticleDraft>) => buildSaveRequest({ mode: "edit", id: ID, current: draft(over), saved: draft(), meta: META, now: NOW })
    expect(check({ title: "  " })).toEqual({ kind: "invalid", error: "Donnez un titre à l'article.", target: "title" })
    expect(check({ content: "\n" })).toMatchObject({ kind: "invalid", target: "content" })
    expect(check({ slug: "Adresse accentuée-é" })).toMatchObject({ kind: "invalid", target: "slug" })
    expect(check({ slug: "" })).toMatchObject({ kind: "invalid", target: "slug" })
    expect(check({ keyword: "https://qonforme.fr/modele" })).toMatchObject({ kind: "invalid", target: "keyword" })
    expect(check({ coverUrl: "javascript:alert(1)" })).toMatchObject({ kind: "invalid", target: "cover" })
    expect(check({ coverAlt: "<b>alt</b>" })).toMatchObject({ kind: "invalid", target: "cover" })
    expect(check({ publication: { mode: "schedule", day: "2026-10-16", time: "08:00" } })).toMatchObject({ kind: "invalid", target: "publication" })
    expect(check({ publication: { mode: "schedule", day: "", time: "08:00" } })).toEqual({ kind: "invalid", error: "Choisissez le jour de publication.", target: "publication" })
  })
})

describe("buildSaveRequest — création", () => {
  const blank = newDraft(null, "08:00", NOW).draft
  const written: ArticleDraft = { ...blank, title: " Exemple de devis de plomberie ", slug: "exemple-devis-plomberie-", content: "Un devis détaille chaque ligne.", keyword: "Exemple Devis Plomberie" }

  it("envoie tous les champs, adresse mise au propre, sans date pour un brouillon", () => {
    const req = buildSaveRequest({ mode: "create", current: written, saved: null, meta: metaOfPost(null), now: NOW })
    expect(req).toMatchObject({ kind: "request", method: "POST", url: "/api/admin/blog", change: "draft" })
    if (req.kind !== "request") throw new Error()
    expect(req.body).toEqual({
      title: "Exemple de devis de plomberie",
      slug: "exemple-devis-plomberie",
      content: "Un devis détaille chaque ligne.",
      excerpt: "",
      cover_url: "",
      cover_alt: null,
      seo_title: "",
      seo_description: "",
      target_keyword: "exemple devis plomberie",
      is_published: false,
    })
  })

  it("programme ou publie dès la création", () => {
    const scheduled = buildSaveRequest({ mode: "create", current: { ...written, publication: { mode: "schedule", day: "2026-10-22", time: "08:00" } }, saved: null, meta: metaOfPost(null), now: NOW })
    expect(scheduled).toMatchObject({ change: "schedule", body: { is_published: false, scheduled_at: "2026-10-22T06:00:00.000Z" } })
    const published = buildSaveRequest({ mode: "create", current: { ...written, publication: { mode: "publish", day: "", time: "" } }, saved: null, meta: metaOfPost(null), now: NOW })
    expect(published).toMatchObject({ change: "publish", body: { is_published: true } })
    expect(published.kind === "request" && published.body).not.toHaveProperty("scheduled_at")
  })

  it("exige titre, texte et adresse", () => {
    expect(buildSaveRequest({ mode: "create", current: blank, saved: null, meta: metaOfPost(null), now: NOW })).toMatchObject({ kind: "invalid", target: "title" })
    expect(buildSaveRequest({ mode: "create", current: { ...blank, title: "Titre" }, saved: null, meta: metaOfPost(null), now: NOW })).toMatchObject({ kind: "invalid", target: "content" })
    expect(buildSaveRequest({ mode: "create", current: { ...blank, title: "Titre", content: "Texte" }, saved: null, meta: metaOfPost(null), now: NOW })).toMatchObject({ kind: "invalid", target: "slug" })
  })
})

describe("après l'enregistrement", () => {
  const draftMeta: SavedMeta = { isPublished: false, publishedAt: null, scheduledAt: "2026-10-21T06:00:00.000Z", reviewStatus: "to_review", heldReason: "Contrôle" }

  it("met à jour le statut enregistré", () => {
    expect(metaAfterSave(draftMeta, "publish", null, NOW)).toEqual({ isPublished: true, publishedAt: NOW.toISOString(), scheduledAt: null, reviewStatus: "to_review", heldReason: null })
    // Un article déjà en ligne garde sa date de publication
    expect(metaAfterSave(META, "publish", null, NOW).publishedAt).toBe(POST.published_at)
    expect(metaAfterSave(draftMeta, "schedule", "2026-10-22T06:00:00.000Z", NOW)).toEqual({ isPublished: false, publishedAt: null, scheduledAt: "2026-10-22T06:00:00.000Z", reviewStatus: null, heldReason: null })
    expect(metaAfterSave(META, "unpublish", null, NOW)).toMatchObject({ isPublished: false, scheduledAt: null })
    expect(metaAfterSave(draftMeta, "unschedule", null, NOW)).toMatchObject({ scheduledAt: null })
    expect(metaAfterSave(draftMeta, "none", null, NOW)).toBe(draftMeta)
  })

  it("annonce précisément ce qui s'est passé", () => {
    expect(successMessage({ created: true, change: "draft", scheduledAt: null, now: NOW })).toBe("Brouillon créé")
    expect(successMessage({ created: false, change: "none", scheduledAt: null, now: NOW })).toBe("Modifications enregistrées")
    expect(successMessage({ created: false, change: "publish", scheduledAt: null, now: NOW })).toBe("Article publié sur le blog")
    expect(successMessage({ created: false, change: "schedule", scheduledAt: "2026-10-16T17:45:00.000Z", now: NOW })).toBe("Publication programmée aujourd'hui à 19:45")
    expect(successMessage({ created: true, change: "schedule", scheduledAt: "2026-10-22T06:00:00.000Z", now: NOW })).toBe("Article créé : publication programmée le jeudi 22 octobre à 08:00")
    expect(successMessage({ created: false, change: "unpublish", scheduledAt: null, now: NOW })).toMatch(/^Article retiré du blog/)
  })

  it("nomme le bouton de la carte Publication d'après ce qu'il va faire", () => {
    const off: SavedMeta = { ...META, isPublished: false }
    expect(saveActionLabel("publish", off, true)).toBe("Publier maintenant")
    expect(saveActionLabel("publish", META, false)).toBe("Enregistrer")
    expect(saveActionLabel("schedule", off, true)).toBe("Programmer la publication")
    expect(saveActionLabel("schedule", off, false)).toBe("Enregistrer")
    expect(saveActionLabel("draft", META, true)).toBe("Retirer du blog")
  })

  it("lit les passages bloquants d'une réponse 409", () => {
    expect(
      issuesOf({ code: "check_failed", issues: [{ label: "Valeur périmée", excerpt: " 36 800 € ", detail: "" }, { label: "Affirmation interdite" }, { excerpt: "sans libellé" }, null] }),
    ).toEqual([
      { label: "Valeur périmée", excerpt: "36 800 €", detail: null },
      { label: "Affirmation interdite", excerpt: null, detail: null },
    ])
    expect(issuesOf({ error: "Cette adresse est déjà utilisée par un autre article." })).toEqual([])
    expect(issuesOf(null)).toEqual([])
  })

  it("renvoie un message d'erreur du serveur au bon champ et au bon onglet", () => {
    expect(targetOfError("Cette adresse est déjà utilisée par un autre article.")).toBe("slug")
    expect(targetOfError("L'image de couverture doit avoir une adresse web complète (https://…).")).toBe("cover")
    expect(targetOfError("Le texte alternatif ne peut pas contenir les signes « < » ni « > ».")).toBe("cover")
    expect(targetOfError("Le mot-clé principal est une requête, pas une adresse web.")).toBe("keyword")
    expect(targetOfError("Choisissez une date et une heure à venir, au moins une minute après maintenant.")).toBe("publication")
    expect(targetOfError("Erreur serveur")).toBeNull()
    expect(tabOfTarget("excerpt")).toBe("redaction")
    expect(tabOfTarget("seoTitle")).toBe("referencement")
    expect(tabOfTarget("publication")).toBe("publication")
  })

  it("écrit les jours en toutes lettres", () => {
    expect(dayLabel("2026-10-01")).toBe("jeudi 1er octobre")
    expect(relativeDay("2026-10-16", NOW)).toBe("aujourd'hui")
    expect(relativeDay("2026-10-17", NOW)).toBe("demain")
    expect(relativeDay("2026-10-22", NOW)).toBe("le jeudi 22 octobre")
  })
})

/* ------------------------------------------------------------------ */
/* Brouillon local                                                     */
/* ------------------------------------------------------------------ */

describe("brouillon local", () => {
  const savedAt = Date.parse(POST.updated_at as string)

  it("a une clé par article", () => {
    expect(localDraftKey(ID)).toBe(`q-blog-editor:${ID}`)
    expect(localDraftKey(null)).toBe("q-blog-editor:nouveau")
  })

  it("relit ce qu'il a écrit", () => {
    const local = draft({ title: "Titre modifié" })
    expect(parseLocalDraft(serializeLocalDraft(local, 1234))).toEqual({ v: 1, savedAt: 1234, draft: local })
  })

  it("refuse un contenu abîmé ou d'un autre format", () => {
    const ok = JSON.parse(serializeLocalDraft(draft(), 1234))
    expect(parseLocalDraft(null)).toBeNull()
    expect(parseLocalDraft("{pas du json")).toBeNull()
    expect(parseLocalDraft(JSON.stringify({ ...ok, v: 2 }))).toBeNull()
    expect(parseLocalDraft(JSON.stringify({ ...ok, savedAt: "hier" }))).toBeNull()
    expect(parseLocalDraft(JSON.stringify({ ...ok, draft: { ...ok.draft, content: 42 } }))).toBeNull()
    expect(parseLocalDraft(JSON.stringify({ ...ok, draft: { ...ok.draft, keyword: 3 } }))).toBeNull()
    expect(parseLocalDraft(JSON.stringify({ ...ok, draft: { ...ok.draft, publication: { mode: "en ligne", day: "", time: "" } } }))).toBeNull()
  })

  it("ne propose qu'une copie plus récente que l'enregistrement et différente de lui", () => {
    const changed = { v: 1 as const, savedAt: savedAt + 60_000, draft: draft({ content: "Texte repris sur cet appareil" }) }
    expect(draftToOffer(changed, draft(), savedAt)).toBe(changed)
    expect(draftToOffer({ ...changed, savedAt: savedAt - 1 }, draft(), savedAt)).toBeNull()
    expect(draftToOffer({ ...changed, draft: draft() }, draft(), savedAt)).toBeNull()
    // Article jamais enregistré : toute copie différente est proposée
    expect(draftToOffer(changed, newDraft(null, "08:00", NOW).draft, null)).toBe(changed)
    expect(draftToOffer(null, draft(), savedAt)).toBeNull()
  })

  it("propose une copie partie du texte encore enregistré, quelle que soit l'horloge de l'appareil", () => {
    // Copie d'un article programmé, publié à l'heure prévue entre-temps : daté après la copie, texte inchangé
    const base = draft({ publication: { mode: "schedule", day: "2026-10-17", time: "08:00" } })
    const savedNow = draft({ publication: { mode: "publish", day: "2026-10-18", time: "08:00" } })
    const copy = { v: 1 as const, savedAt: savedAt - 3_600_000, draft: { ...base, content: "Texte repris sur cet appareil" }, base }
    expect(draftToOffer(copy, savedNow, savedAt)).toBe(copy)
    // Restaurée, elle garde la publication d'aujourd'hui (le serveur l'a changée depuis)
    expect(publicationMovedSince(copy, savedNow)).toBe(true)
    expect(restoreDraft(copy, savedNow, publicationMovedSince(copy, savedNow)).publication).toEqual(savedNow.publication)
    expect(publicationMovedSince(copy, base)).toBe(false)
    expect(publicationMovedSince({ v: 1, savedAt, draft: base }, savedNow)).toBe(false)
  })

  it("ne propose pas une copie plus ancienne dont le texte a été remplacé depuis, ni une simple publication", () => {
    const base = draft()
    const copy = { v: 1 as const, savedAt: savedAt - 1, draft: draft({ content: "Ma version" }), base }
    // Texte modifié ailleurs après la copie : la date décide
    expect(draftToOffer(copy, draft({ content: "Version enregistrée ailleurs" }), savedAt)).toBeNull()
    expect(draftToOffer({ ...copy, savedAt: savedAt + 1 }, draft({ content: "Version enregistrée ailleurs" }), savedAt)).not.toBeNull()
    // Copie qui ne change que la publication, plus ancienne que l'enregistrement : rien à proposer
    const onlyPublication = { v: 1 as const, savedAt: savedAt - 1, draft: draft({ publication: { mode: "schedule", day: "2026-10-22", time: "08:00" } }), base }
    expect(draftToOffer(onlyPublication, draft(), savedAt)).toBeNull()
  })

  it("garde la version de départ dans la copie, et lit encore les copies sans elle", () => {
    const raw = serializeLocalDraft(draft({ title: "Nouveau titre" }), 42, draft())
    expect(parseLocalDraft(raw)?.base).toEqual(draft())
    const old = serializeLocalDraft(draft({ title: "Nouveau titre" }), 42)
    expect(parseLocalDraft(old)?.base).toBeUndefined()
    // Version de départ abîmée : ignorée, la copie reste lisible
    const broken = JSON.stringify({ ...JSON.parse(raw), base: { title: 3 } })
    expect(parseLocalDraft(broken)?.draft.title).toBe("Nouveau titre")
    expect(parseLocalDraft(broken)?.base).toBeUndefined()
  })

  it("garde la publication choisie à l'ouverture si on le demande", () => {
    const local = { v: 1 as const, savedAt: 1, draft: draft({ title: "Ancien", publication: { mode: "draft", day: "2026-10-17", time: "08:00" } }) }
    const current = draft({ publication: { mode: "schedule", day: "2026-10-22", time: "08:00" } })
    expect(restoreDraft(local, current, true)).toEqual({ ...local.draft, publication: current.publication })
    expect(restoreDraft(local, current, false)).toBe(local.draft)
  })
})

/* ------------------------------------------------------------------ */
/* Sortie de la page                                                   */
/* ------------------------------------------------------------------ */

describe("internalHrefOf", () => {
  const click = (html: string, init: MouseEventInit = {}) => {
    document.body.innerHTML = html
    const target = document.querySelector("[data-cible]") as HTMLElement
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init })
    Object.defineProperty(event, "target", { value: target })
    return internalHrefOf(event, { href: "http://localhost:3100/admin/blog/1", origin: "http://localhost:3100", pathname: "/admin/blog/1", search: "" } as Location)
  }

  it("intercepte un lien interne vers une autre page", () => {
    expect(click('<a href="/admin/blog"><span data-cible>Blog</span></a>')).toBe("/admin/blog")
    expect(click('<a href="http://localhost:3100/admin/seo/articles?mois=2026-10" data-cible>Calendrier</a>')).toBe("/admin/seo/articles?mois=2026-10")
  })

  it("laisse passer les nouveaux onglets, les touches de modification, les ancres et les autres sites", () => {
    expect(click('<a href="/blog/x" target="_blank" data-cible>Voir</a>')).toBeNull()
    expect(click('<a href="/admin/blog" data-cible>Blog</a>', { metaKey: true })).toBeNull()
    expect(click('<a href="/admin/blog" data-cible>Blog</a>', { button: 1 })).toBeNull()
    expect(click('<a href="#plan" data-cible>Plan</a>')).toBeNull()
    expect(click('<a href="https://www.service-public.gouv.fr/" data-cible>Service public</a>')).toBeNull()
    expect(click('<a href="/fichier.pdf" download data-cible>PDF</a>')).toBeNull()
    expect(click('<button data-cible>Bouton</button>')).toBeNull()
  })

  it("ne touche pas aux liens de la zone d'écriture", () => {
    expect(click('<div class="ProseMirror" contenteditable="true"><p><a href="/guide/tva-travaux" data-cible>guide</a></p></div>')).toBeNull()
  })
})
