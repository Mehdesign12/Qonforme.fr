/**
 * Valeur affichée d'un indicateur : « — » (valeur absente) est masqué aux
 * lecteurs d'écran et remplacé par un texte lisible. Sans hook : composants
 * serveur et client.
 */
export function Val({ text, missing = "non disponible" }: { text: string; missing?: string }) {
  if (text !== "—") return <>{text}</>
  return (
    <>
      <span aria-hidden>—</span>
      <span className="sr-only">{missing}</span>
    </>
  )
}
