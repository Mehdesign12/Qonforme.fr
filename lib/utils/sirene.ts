import { SireneResult } from '@/types'

// ---- Recherche d'entreprise par SIREN via API INSEE ----
export async function searchBySiren(siren: string): Promise<SireneResult | null> {
  try {
    const response = await fetch(
      `https://api.insee.fr/entreprises/sirene/V3.11/siren/${siren}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.INSEE_API_KEY}`,
          Accept: 'application/json',
        },
      }
    )

    if (!response.ok) return null

    const data = await response.json()
    const uniteLegale = data.uniteLegale

    if (!uniteLegale) return null

    const periodeUniteLegale =
      uniteLegale.periodesUniteLegale?.[0]

    const name =
      periodeUniteLegale?.denominationUniteLegale ||
      `${periodeUniteLegale?.prenom1UniteLegale ?? ''} ${periodeUniteLegale?.nomUniteLegale ?? ''}`.trim()

    return {
      siren,
      name,
      address: '',
      zip_code: '',
      city: '',
    }
  } catch {
    return null
  }
}

// ---- Recherche d'établissement par SIRET ----
export async function searchBySiret(siret: string): Promise<SireneResult | null> {
  try {
    const response = await fetch(
      `https://api.insee.fr/entreprises/sirene/V3.11/siret/${siret}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.INSEE_API_KEY}`,
          Accept: 'application/json',
        },
      }
    )

    if (!response.ok) return null

    const data = await response.json()
    const etablissement = data.etablissement

    if (!etablissement) return null

    const adresse = etablissement.adresseEtablissement
    const uniteLegale = etablissement.uniteLegale
    const periodeUniteLegale = uniteLegale?.periodesUniteLegale?.[0]

    const name =
      periodeUniteLegale?.denominationUniteLegale ||
      `${periodeUniteLegale?.prenom1UniteLegale ?? ''} ${periodeUniteLegale?.nomUniteLegale ?? ''}`.trim()

    return {
      siren: siret.substring(0, 9),
      siret,
      name,
      address: `${adresse?.numeroVoieEtablissement ?? ''} ${adresse?.typeVoieEtablissement ?? ''} ${adresse?.libelleVoieEtablissement ?? ''}`.trim(),
      zip_code: adresse?.codePostalEtablissement ?? '',
      city: adresse?.libelleCommuneEtablissement ?? '',
    }
  } catch {
    return null
  }
}

// ---- Route API Next.js pour la recherche SIREN (appelée depuis le frontend) ----
// Utilisée dans /app/api/sirene/route.ts pour ne pas exposer la clé INSEE
