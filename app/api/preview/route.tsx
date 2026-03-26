import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const TYPE_COLORS: Record<string, { bg: string; accent: string; label: string }> = {
  facture: { bg: "#EFF6FF", accent: "#2563EB", label: "FACTURE" },
  devis: { bg: "#F0FDF4", accent: "#16A34A", label: "DEVIS" },
  avoir: { bg: "#FFF7ED", accent: "#EA580C", label: "AVOIR" },
  "bon-de-commande": { bg: "#FAF5FF", accent: "#9333EA", label: "BON DE COMMANDE" },
  relance: { bg: "#FEF2F2", accent: "#DC2626", label: "RELANCE" },
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const title = searchParams.get("title") || "Modele de document";
  const type = searchParams.get("type") || "facture";
  const items = (searchParams.get("items") || "").split("|").filter(Boolean).slice(0, 5);

  const colors = TYPE_COLORS[type] ?? TYPE_COLORS.facture;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F8FAFC",
          fontFamily: "sans-serif",
          padding: "40px",
        }}
      >
        {/* Document card */}
        <div
          style={{
            width: "480px",
            height: "520px",
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Type bar */}
          <div
            style={{
              height: "4px",
              background: colors.accent,
              display: "flex",
            }}
          />

          {/* Header */}
          <div
            style={{
              padding: "24px 28px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "22px", fontWeight: 800, color: "#0F172A" }}>
                <span style={{ color: "#2563EB" }}>Q</span>onforme
              </div>
              <div style={{ fontSize: "11px", color: "#94A3B8", display: "flex" }}>
                123 Rue Exemple, 75001 Paris
              </div>
            </div>
            <div
              style={{
                padding: "4px 12px",
                borderRadius: "6px",
                background: colors.bg,
                color: colors.accent,
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.05em",
                display: "flex",
              }}
            >
              {colors.label}
            </div>
          </div>

          {/* Separator */}
          <div style={{ height: "1px", background: "#E2E8F0", margin: "0 28px", display: "flex" }} />

          {/* Meta */}
          <div style={{ padding: "14px 28px", display: "flex", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <div style={{ fontSize: "10px", color: "#94A3B8", fontWeight: 600, display: "flex" }}>CLIENT</div>
              <div style={{ fontSize: "13px", color: "#0F172A", fontWeight: 600, display: "flex" }}>Entreprise Exemple</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: "flex-end" }}>
              <div style={{ fontSize: "10px", color: "#94A3B8", fontWeight: 600, display: "flex" }}>DATE</div>
              <div style={{ fontSize: "13px", color: "#0F172A", fontWeight: 600, display: "flex" }}>26/03/2026</div>
            </div>
          </div>

          {/* Items table */}
          <div style={{ padding: "0 28px", display: "flex", flexDirection: "column", flex: 1 }}>
            {/* Header row */}
            <div style={{ display: "flex", padding: "8px 0", borderBottom: "1px solid #E2E8F0" }}>
              <div style={{ flex: 1, fontSize: "10px", color: "#94A3B8", fontWeight: 700, display: "flex" }}>DESIGNATION</div>
              <div style={{ width: "70px", fontSize: "10px", color: "#94A3B8", fontWeight: 700, textAlign: "right", display: "flex", justifyContent: "flex-end" }}>MONTANT</div>
            </div>
            {/* Rows */}
            {items.map((item, i) => (
              <div key={i} style={{ display: "flex", padding: "10px 0", borderBottom: "1px solid #F1F5F9" }}>
                <div style={{ flex: 1, fontSize: "12px", color: "#334155", display: "flex" }}>{item}</div>
                <div style={{ width: "70px", fontSize: "12px", color: "#0F172A", fontWeight: 600, textAlign: "right", display: "flex", justifyContent: "flex-end" }}>
                  {(150 + i * 230).toFixed(2)} €
                </div>
              </div>
            ))}
            {/* Empty rows if fewer than 5 items */}
            {Array.from({ length: Math.max(0, 3 - items.length) }).map((_, i) => (
              <div key={`empty-${i}`} style={{ display: "flex", padding: "10px 0", borderBottom: "1px solid #F1F5F9" }}>
                <div style={{ flex: 1, display: "flex" }}>
                  <div style={{ width: `${60 + i * 20}%`, height: "10px", background: "#F1F5F9", borderRadius: "4px", display: "flex" }} />
                </div>
                <div style={{ width: "70px", display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ width: "50px", height: "10px", background: "#F1F5F9", borderRadius: "4px", display: "flex" }} />
                </div>
              </div>
            ))}
          </div>

          {/* Total bar */}
          <div
            style={{
              margin: "0 28px",
              padding: "12px 16px",
              background: colors.bg,
              borderRadius: "8px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <div style={{ fontSize: "12px", color: "#64748B", fontWeight: 600, display: "flex" }}>TOTAL TTC</div>
            <div style={{ fontSize: "18px", color: colors.accent, fontWeight: 800, display: "flex" }}>
              {items.length > 0 ? `${items.reduce((sum, _, i) => sum + 150 + i * 230, 0).toFixed(2)} €` : "— €"}
            </div>
          </div>
        </div>

        {/* Right side — title + CTA */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 40px",
            maxWidth: "420px",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 700, color: colors.accent, letterSpacing: "0.1em", marginBottom: "8px", display: "flex" }}>
            MODELE GRATUIT
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "#0F172A", lineHeight: 1.2, marginBottom: "16px", display: "flex" }}>
            {title}
          </div>
          <div style={{ fontSize: "14px", color: "#64748B", lineHeight: 1.5, marginBottom: "24px", display: "flex" }}>
            Conforme a la reglementation francaise 2026. Toutes les mentions obligatoires incluses.
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              background: "#2563EB",
              borderRadius: "10px",
              color: "#FFFFFF",
              fontSize: "14px",
              fontWeight: 700,
              width: "fit-content",
            }}
          >
            Utiliser ce modele →
          </div>
        </div>
      </div>
    ),
    {
      width: 1000,
      height: 600,
    }
  );
}
