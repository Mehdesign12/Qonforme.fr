/**
 * Téléchargement d'un PDF généré par l'API : relit la réponse, refuse ce qui
 * n'est pas un PDF (page de connexion renvoyée en 200, erreur en texte) et
 * laisse au navigateur le temps de lire le fichier avant de libérer son adresse
 * (la libérer aussitôt casse le téléchargement sur certains navigateurs).
 */
export class PdfDownloadError extends Error {}

export async function downloadPdf(url: string, filename: string): Promise<void> {
  const res = await fetch(url, { credentials: "same-origin" })
  if (!res.ok) throw new PdfDownloadError("Erreur lors de la génération du PDF")
  const bytes = new Uint8Array(await res.arrayBuffer())
  const isPdf = bytes.length > 8 && String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]) === "%PDF-"
  if (!isPdf) throw new PdfDownloadError("Le fichier reçu n'est pas un PDF valide. Réessayez dans un instant.")
  const blobUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }))
  const a = document.createElement("a")
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
}
