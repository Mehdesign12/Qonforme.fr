import type { Modele } from "@/lib/pseo/modeles"

/**
 * Aperçu schématique d'un modèle (feuille blanche sur fond grisé, canevas
 * « Fondations » : q-paper-bed > q-paper). Les valeurs sont des traits gris,
 * jamais des montants ou des noms inventés. La feuille reste blanche dans les
 * deux thèmes, comme un vrai document.
 */

const DOC: Record<Modele["type"], { label: string; prefix: string }> = {
  facture: { label: "Facture", prefix: "F" },
  devis: { label: "Devis", prefix: "D" },
  avoir: { label: "Avoir", prefix: "AV" },
  "bon-de-commande": { label: "Bon de commande", prefix: "BC" },
  relance: { label: "Relance", prefix: "F" },
}

/** Trait gris qui tient la place d'une valeur à remplir. */
function Bar({ w, h = 8, className = "" }: { w: string; h?: number; className?: string }) {
  return <span aria-hidden className={`block rounded-full bg-[#E6E9F0] ${className}`} style={{ width: w, height: h }} />
}

/**
 * Modèles qui ne portent pas l'intitulé ni le numéro de leur type : la facture
 * proforma n'est pas une facture et n'entre pas dans la numérotation.
 */
const DOC_BY_SLUG: Record<string, { label: string; prefix: string }> = {
  "facture-proforma": { label: "Proforma", prefix: "PRO" },
}

export default function ModelePaper({ modele }: { modele: Modele }) {
  const doc = DOC_BY_SLUG[modele.slug] ?? DOC[modele.type] ?? DOC.facture
  const isLetter = modele.type === "relance"
  const isReference = isLetter || modele.slug in DOC_BY_SLUG

  return (
    <figure className="q-paper mx-auto w-full max-w-[620px] p-6 text-[#0F172A] sm:p-10" aria-label={`Aperçu schématique : ${modele.titre}`}>
      {/* En-tête : émetteur à gauche, type et numéro à droite */}
      <div className="flex items-start justify-between gap-6">
        <div className="flex flex-col gap-2">
          <span aria-hidden className="mb-1 grid h-9 w-9 place-items-center rounded-[10px] bg-[#0A1122] font-display text-[17px] font-semibold text-white">
            Q
          </span>
          <Bar w="120px" h={9} className="bg-[#CBD5E1]" />
          <Bar w="150px" />
          <Bar w="96px" />
        </div>
        <div className="flex flex-col items-end gap-1.5 text-right">
          <p className="font-display text-[22px] font-semibold uppercase leading-none tracking-[-0.01em] text-[#2563EB] sm:text-[26px]">{doc.label}</p>
          <p className="font-mono text-[12px] text-[#64748B]">
            {isReference ? "Réf. " : "N° "}
            {doc.prefix}-2026-001
          </p>
        </div>
      </div>

      {/* Destinataire */}
      <div className="mt-8 grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">{isLetter ? "Destinataire" : "Client"}</p>
          <Bar w="70%" h={9} className="bg-[#CBD5E1]" />
          <Bar w="85%" />
          <Bar w="55%" />
        </div>
        <div className="flex flex-col items-end gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">Date</p>
          <Bar w="72px" />
          {!isLetter && (
            <>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">{modele.type === "devis" ? "Validité" : "Échéance"}</p>
              <Bar w="64px" />
            </>
          )}
        </div>
      </div>

      {isLetter ? (
        /* Lettre de relance : objet, corps, signature */
        <div className="mt-8 flex flex-col gap-2.5">
          <p className="text-[12px] font-semibold text-[#0F172A]">Objet : relance de facture impayée</p>
          {["96%", "100%", "88%", "92%", "60%"].map((w, i) => (
            <Bar key={i} w={w} className={i === 3 ? "mt-3" : ""} />
          ))}
          <div className="mt-6 flex justify-end">
            <Bar w="110px" h={9} className="bg-[#CBD5E1]" />
          </div>
        </div>
      ) : (
        <>
          {/* Lignes du document */}
          <div className="mt-8">
            <div className="grid grid-cols-[minmax(0,1fr)_44px_72px] gap-3 border-b border-[#E6E9F0] pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">
              <span>Désignation</span>
              <span className="text-right">Qté</span>
              <span className="text-right">Total HT</span>
            </div>
            {["78%", "64%", "86%", "52%"].map((w, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_44px_72px] items-center gap-3 border-b border-[#F1F4F8] py-3">
                <Bar w={w} />
                <Bar w="20px" className="ml-auto" />
                <Bar w="52px" className="ml-auto" />
              </div>
            ))}
          </div>

          {/* Totaux */}
          <div className="ml-auto mt-5 flex w-[220px] max-w-full flex-col gap-2.5">
            {["Total HT", "TVA"].map((l) => (
              <div key={l} className="flex items-center justify-between text-[12px] text-[#64748B]">
                {l}
                <Bar w="60px" />
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-[#E6E9F0] pt-2.5 text-[13px] font-semibold text-[#0F172A]">
              {modele.type === "avoir" ? "Total à déduire" : "Total TTC"}
              <Bar w="72px" h={9} className="bg-[#BFD3FF]" />
            </div>
          </div>
        </>
      )}

      {/* Mentions en pied de page */}
      <div className="mt-8 flex flex-col gap-1.5 border-t border-[#E6E9F0] pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">Mentions obligatoires</p>
        <Bar w="94%" h={6} />
        <Bar w="70%" h={6} />
      </div>
    </figure>
  )
}
