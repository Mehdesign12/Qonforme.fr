/**
 * Rappels envoyés à l'artisan lui-même : un rendez-vous qui approche, ou les
 * tâches dont il a demandé le rappel. Courts, vouvoiement, sans promesse de
 * contact humain ; le texte saisi par l'artisan est toujours échappé.
 */
import { emailBase, ctaButton, monoLabel, FONT_BODY } from "@/lib/email/templates/base"

const esc = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string)

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:11px 0;border-bottom:1px solid #E7E4DC;font-family:${FONT_BODY};font-size:14px;color:#4F5257;width:34%;">${label}</td>
    <td style="padding:11px 0;border-bottom:1px solid #E7E4DC;font-family:${FONT_BODY};font-size:14px;font-weight:600;color:#15171C;">${value}</td>
  </tr>`
}

export interface AppointmentReminderData {
  title: string
  kindLabel: string
  /** « jeudi 22 octobre à 8 h » */
  whenLabel: string
  /** « dans 1 h » ou « demain » */
  inLabel: string
  clientName: string | null
  address: string | null
  mapsUrl: string | null
  planningUrl: string
}

export function buildAppointmentReminderEmail(d: AppointmentReminderData): { subject: string; html: string } {
  const rows =
    row("Quand", esc(d.whenLabel)) +
    row("Type", esc(d.kindLabel)) +
    (d.clientName ? row("Client", esc(d.clientName)) : "") +
    (d.address ? row("Adresse", d.mapsUrl ? `${esc(d.address)}<br/><a href="${esc(d.mapsUrl)}" style="color:#2B2E35;font-weight:500;">Itinéraire</a>` : esc(d.address)) : "")
  const body = `
    <p style="margin:0 0 6px;font-size:16px;line-height:1.6;color:#2B2E35;"><strong>${esc(d.title)}</strong> a lieu ${esc(d.inLabel)}.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-top:1px solid #E7E4DC;">${rows}</table>
    ${ctaButton("Ouvrir le planning", esc(d.planningUrl))}
    <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#4F5257;">Vous recevez cet email parce que vous avez demandé un rappel pour ce rendez-vous. Il se retire en le modifiant dans le planning.</p>`
  return {
    subject: `Rappel : ${d.title} ${d.inLabel}`,
    html: emailBase({
      companyName: "Qonforme",
      preheader: esc(`${d.title}, ${d.whenLabel}`),
      replyNote: "",
      body,
      source: "email-rappel",
      headline: "Un rendez-vous",
      headlineAccent: "approche.",
    }),
  }
}

export interface TaskReminderData {
  tasks: { body: string; dueLabel: string | null; clientName: string | null }[]
  planningUrl: string
}

export function buildTasksReminderEmail(d: TaskReminderData): { subject: string; html: string } {
  const n = d.tasks.length
  const items = d.tasks
    .map((t) => `<tr><td style="padding:12px 0;border-bottom:1px solid #E7E4DC;font-family:${FONT_BODY};">
      <div style="font-size:15px;line-height:1.5;color:#15171C;font-weight:600;white-space:pre-line;">${esc(t.body)}</div>
      ${t.dueLabel || t.clientName ? `<div style="margin-top:3px;font-size:13px;color:#4F5257;">${[t.dueLabel ? `Pour ${esc(t.dueLabel)}` : "", t.clientName ? esc(t.clientName) : ""].filter(Boolean).join(" · ")}</div>` : ""}
    </td></tr>`)
    .join("")
  const body = `
    <p style="margin:0 0 6px;font-size:16px;line-height:1.6;color:#2B2E35;">${n > 1 ? `Vous avez demandé un rappel pour ${n} tâches.` : "Vous avez demandé un rappel pour cette tâche."}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;border-top:1px solid #E7E4DC;">${items}</table>
    ${ctaButton("Voir mes tâches", esc(d.planningUrl))}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid #E7E4DC;"><tr><td style="padding:14px 0 0;">
      ${monoLabel("À savoir")}
      <p style="margin:6px 0 0;font-size:14px;line-height:1.6;color:#2B2E35;">Cochez la tâche dans Qonforme une fois faite : elle ne vous sera plus rappelée.</p>
    </td></tr></table>`
  return {
    subject: n > 1 ? `Rappel : ${n} tâches à faire` : `Rappel : ${d.tasks[0].body.replace(/\s+/g, " ").slice(0, 70)}`,
    html: emailBase({
      companyName: "Qonforme",
      preheader: n > 1 ? `${n} tâches à faire` : esc(d.tasks[0].body.replace(/\s+/g, " ").slice(0, 90)),
      replyNote: "",
      body,
      source: "email-rappel",
      headline: n > 1 ? "Vos tâches" : "Votre tâche",
      headlineAccent: "à faire.",
    }),
  }
}
