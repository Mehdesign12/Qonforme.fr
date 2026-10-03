/**
 * Mentions légales en pied d'un aperçu papier (devis, bon de commande, avoir),
 * comme sur le PDF : mentions automatiques du profil de l'entreprise puis
 * mentions libres (lib/legal/mentions.ts). La feuille reste blanche en thème
 * sombre : couleurs fixes, comme le reste du papier.
 */
export function PaperMentions({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null
  return (
    <p className="whitespace-pre-line border-t border-[#F1F4F8] pt-3 text-center text-[10px] leading-[1.55] text-[#64748B]">
      {lines.join("\n")}
    </p>
  )
}
