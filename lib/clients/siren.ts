/** Chiffres du SIREN saisi pour un client ; un SIRET (14 chiffres) est ramené à son SIREN. */
export function sirenDigits(value: string): string {
  const d = value.replace(/\D/g, "")
  return d.length === 14 ? d.slice(0, 9) : d
}
