import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/resend";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prenom, nom, email, sujet, message } = body;

    // Validation
    if (!prenom || !nom || !email || !sujet || !message) {
      return NextResponse.json(
        { error: "Tous les champs sont requis" },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Email invalide" },
        { status: 400 }
      );
    }

    const sujetLabels: Record<string, string> = {
      abonnement: "Question abonnement",
      technique: "Problème technique",
      conformite: "Question conformité",
      autre: "Autre",
    };

    const sujetLabel = sujetLabels[sujet] ?? sujet;

    await sendEmail({
      to: process.env.RESEND_FROM_EMAIL || "contact@qonforme.fr",
      subject: `[Contact] ${sujetLabel} — ${prenom} ${nom}`,
      replyTo: email,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto;">
          <div style="background: #EFF6FF; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 4px; font-size: 18px; color: #0F172A;">Nouveau message de contact</h2>
            <p style="margin: 0; font-size: 13px; color: #64748B;">Reçu depuis qonforme.fr</p>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 8px 0; color: #64748B; width: 100px;">Nom</td>
              <td style="padding: 8px 0; color: #0F172A; font-weight: 600;">${prenom} ${nom}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748B;">Email</td>
              <td style="padding: 8px 0;"><a href="mailto:${email}" style="color: #2563EB;">${email}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748B;">Sujet</td>
              <td style="padding: 8px 0; color: #0F172A;">${sujetLabel}</td>
            </tr>
          </table>
          <div style="margin-top: 20px; padding: 16px; background: #F8FAFC; border-radius: 8px; border: 1px solid #E2E8F0;">
            <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em;">Message</p>
            <p style="margin: 0; font-size: 14px; color: #0F172A; line-height: 1.6; white-space: pre-wrap;">${message}</p>
          </div>
          <p style="margin-top: 20px; font-size: 12px; color: #94A3B8;">Répondre directement à cet email enverra la réponse à ${email}.</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Contact form error:", e);
    return NextResponse.json(
      { error: "Erreur lors de l'envoi du message" },
      { status: 500 }
    );
  }
}
