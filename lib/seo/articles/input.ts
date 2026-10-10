/**
 * Corps des requêtes du module Articles (routes /api/admin/seo/articles/** et
 * /api/admin/seo/topics/**), validés par zod, messages en français.
 */
import { z } from "zod"
import { isIsoDay } from "@/lib/utils/paris-date"

export const ID = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Identifiant invalide")
const articleType = z.enum(["howto", "guide", "news", "faq"], { message: "Type d'article inconnu" })
const publishMode = z.enum(["draft", "after_check", "direct"], { message: "Mode de publication inconnu" })
const day = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "Date attendue (AAAA-MM-JJ)")
  .refine(isIsoDay, "Cette date n'existe pas")
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure attendue (HH:MM)")
const title = z.string().trim().min(5, "Le sujet doit faire au moins 5 caractères").max(160, "Sujet de 160 caractères au plus")
const keyword = z
  .string()
  .trim()
  .max(120, "Mot-clé de 120 caractères au plus")
  .transform((s) => s.replace(/\s+/g, " ").toLowerCase())
  .nullable()
  .optional()
const angle = z.string().trim().max(40).nullable().optional()
const notes = z.string().trim().max(1000, "Notes de 1 000 caractères au plus").nullable().optional()

export const scheduleSchema = z.object({ day, time })

export const generateSchema = z
  .object({
    topicId: ID.optional(),
    title: title.optional(),
    keyword,
    articleType,
    /** Clé d'angle, ou « varied » (rotation des Préférences). */
    angle,
    lengthMin: z.number().int().min(600).max(4000),
    lengthMax: z.number().int().min(800).max(5000),
    publication: z.enum(["draft", "schedule", "after_check"], { message: "Mode de publication inconnu" }),
    day: day.optional(),
    time: time.optional(),
  })
  .refine((v) => Boolean(v.topicId || v.title), { message: "Choisissez un sujet ou saisissez-en un", path: ["title"] })
  .refine((v) => v.lengthMin <= v.lengthMax, { message: "La longueur maximale doit dépasser la longueur minimale", path: ["lengthMax"] })
  .refine((v) => v.publication !== "schedule" || (v.day && v.time), { message: "Choisissez le jour et l'heure de publication", path: ["day"] })

export type GenerateInput = z.infer<typeof generateSchema>

export const topicCreateSchema = z.object({
  title,
  keyword,
  articleType,
  angle,
  notes,
  schedule: z.object({ day, time, publishMode }).optional(),
})

export type TopicCreateInput = z.infer<typeof topicCreateSchema>

export const topicPatchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), title, keyword, articleType, angle, notes }),
  z.object({ action: z.literal("schedule"), day, time, publishMode: publishMode.optional() }),
  z.object({ action: z.literal("unschedule") }),
  z.object({ action: z.literal("draft") }),
  z.object({ action: z.literal("retry") }),
  z.object({ action: z.literal("archive") }),
  z.object({ action: z.literal("restore") }),
])

export type TopicPatchInput = z.infer<typeof topicPatchSchema>

export const topicBulkSchema = z.object({
  ids: z.array(ID).min(1, "Sélectionnez au moins un sujet").max(50, "50 sujets au plus à la fois"),
  action: z.enum(["schedule", "draft"], { message: "Action inconnue" }),
})

export const postPatchSchema = z.object({ action: z.enum(["publish", "unpublish"], { message: "Action inconnue" }) })

/** Premier message d'erreur d'une validation zod, et les messages par champ. */
export function zodError(error: z.ZodError): { error: string; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_"
    if (!fieldErrors[path]) fieldErrors[path] = issue.message
  }
  return { error: Object.values(fieldErrors)[0] ?? "Requête invalide", fieldErrors }
}
