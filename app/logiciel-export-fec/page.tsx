import type { Metadata } from "next"
import { Archive, FileSpreadsheet, UserCheck } from "lucide-react"
import { PLANS, TAX_SUFFIX, formatEuros } from "@/lib/stripe/plans"
import { FacturationBlock, PilotageBlock } from "@/components/home/Features"
import { ProductPage, type ProductFaq } from "@/components/content/ProductPage"
import { SectionHeading, WRAP } from "@/components/content/ui"
import { fr } from "@/components/content/text"

/*
 * Page « Logiciel de facturation bâtiment avec export FEC » (30/10/2026).
 *
 * Question posée aux assistants IA (relevé OpenSEO du 30/10/2026, ChatGPT) : « Quel logiciel
 * de facturation BTP fournit un export comptable FEC ? » : aucune marque dominante, et la
 * réponse prévenait que « tous les exports FEC ne se valent pas ». La page dit exactement
 * ce que contient l'export de Qonforme (lib/export/fec.ts) : journaux des ventes et des
 * avoirs, comptes 411, 706 et TVA collectée par taux ; ni achats, ni banque, ni règlements.
 */

const PATH = "/logiciel-export-fec"
const TITRE = "Logiciel de facturation avec export FEC"
const VERIFIE_LE = "2026-10-30"
const DESCRIPTION = "Logiciel de facturation pour artisans du bâtiment avec export FEC : journal des ventes et des avoirs, TVA par taux, prêt pour votre expert-comptable."

const essentiel = PLANS.starter
const prix = (montant: number) => `${formatEuros(montant)}${TAX_SUFFIX}`

export const metadata: Metadata = {
  title: "Logiciel de facturation bâtiment avec export FEC",
  description: DESCRIPTION,
  keywords: ["logiciel facturation export FEC", "export FEC", "logiciel facturation BTP FEC", "fichier des écritures comptables artisan", "export comptable artisan"],
  alternates: { canonical: PATH },
  openGraph: {
    title: `${TITRE} | Qonforme`,
    description: "Export FEC des ventes et des avoirs pour les artisans du bâtiment, prêt pour l'expert-comptable.",
    url: `https://qonforme.fr${PATH}`,
    images: [{ url: "/api/og?title=Export%20FEC&subtitle=Pour%20les%20artisans%20du%20b%C3%A2timent", width: 1200, height: 630 }],
  },
}

/** Ce que contient l'export, d'après lib/export/fec.ts. */
const CONTENU = [
  ["Journaux", "VT (ventes) pour les factures émises, AV (avoirs) pour les avoirs."],
  ["Comptes", "411 (clients) au débit, 706 (prestations de services) au crédit, TVA collectée sur un compte par taux : 20 %, 10 %, 5,5 % et 2,1 %."],
  ["Documents inclus", "Les factures émises et les avoirs de la période choisie ; jamais les brouillons."],
  ["Format", "Les 18 colonnes de l'arrêté du 29 juillet 2013, séparées par des tabulations, dates AAAAMMJJ, montants à virgule, fichier nommé SIREN + FEC + date de clôture."],
  ["Ce qu'il ne contient pas", "Ni achats, ni banque, ni règlements, ni salaires : c'est le FEC de vos ventes, que votre comptable intègre à la comptabilité complète."],
]

const FAQ: ProductFaq[] = [
  {
    question: "Qu'est-ce que le FEC ?",
    reponse: "Le fichier des écritures comptables (FEC) est un fichier texte qui reprend toutes les écritures comptables d'un exercice, dans un format fixé par l'arrêté du 29 juillet 2013. Une entreprise dont la comptabilité est tenue sur informatique doit le remettre à l'administration en cas de contrôle (livre des procédures fiscales, article L47 A-I).",
  },
  {
    question: "Quel logiciel de facturation pour le bâtiment fournit un export FEC ?",
    reponse: `Qonforme, avec la formule ${essentiel.name} : l'export FEC des factures et des avoirs émis, pour la période de votre choix, dans Paramètres › Exports. Vérifiez toujours ce que contient l'export d'un logiciel : celui de Qonforme couvre les ventes et les avoirs, pas les achats ni la banque.`,
  },
  {
    question: "Le FEC de Qonforme suffit-il en cas de contrôle fiscal ?",
    reponse: "Non, pas seul. Il contient vos ventes et vos avoirs ; le FEC remis à l'administration doit couvrir toute la comptabilité de l'exercice. Votre expert-comptable ou votre logiciel de comptabilité importe ce fichier et le complète avec les achats, la banque et les autres écritures.",
  },
  {
    question: "Mon comptable peut-il récupérer mes factures sans me les demander ?",
    reponse: "Oui. Dans Paramètres › Accès comptable, vous invitez votre comptable par e-mail : il consulte vos factures émises, vos avoirs et leurs totaux par taux de TVA en lecture seule, et télécharge lui-même le FEC, les ventes en CSV et les PDF. Vous retirez l'accès quand vous voulez.",
  },
  {
    question: "Combien coûte l'export FEC ?",
    reponse: `Il fait partie de la formule ${essentiel.name}, à ${prix(essentiel.monthlyPrice)} par mois ou ${prix(essentiel.yearlyPrice)} par an, sans engagement, avec l'envoi des factures et les relances. Les devis sont gratuits et illimités.`,
  },
  {
    question: "Quelle est l'amende si l'on ne remet pas le FEC ?",
    reponse: "Le défaut de présentation du FEC lors d'un contrôle est sanctionné par une amende de 5 000 € (code général des impôts, article 1729 D), ou par une majoration des droits si elle est plus élevée.",
  },
]

export default function Page() {
  return (
    <ProductPage
      path={PATH}
      titre={TITRE}
      accent="pour le bâtiment."
      sub={`Qonforme exporte le FEC de vos ventes : chaque facture et chaque avoir émis deviennent des écritures au format de l'administration, avec la TVA collectée par taux, prêtes pour votre expert-comptable. Avec la formule ${essentiel.name}.`}
      description={DESCRIPTION}
      verifieLe={VERIFIE_LE}
      photo="entrepriseGrandit"
      essentiel={[
        ["Pour qui", "Les artisans du bâtiment qui confient leur comptabilité à un expert-comptable ou à un logiciel de comptabilité."],
        ["Ce qu'il exporte", "Le FEC des factures et des avoirs émis (journaux des ventes et des avoirs), les ventes en CSV et les PDF de la période."],
        ["Ce qu'il coûte", `Avec ${essentiel.name} : ${prix(essentiel.monthlyPrice)} par mois, ou ${prix(essentiel.yearlyPrice)} par an. Sans engagement.`],
        ["Pour le comptable", "Un accès en lecture seule, sur invitation, pour consulter et télécharger lui-même ; retiré d'un clic."],
        ["Ce qu'il ne fait pas", "Ni comptabilité complète, ni achats, ni rapprochement bancaire : le FEC couvre vos ventes, le reste reste chez votre comptable."],
      ]}
      fonctions={{ title: "De la facture", accent: "à l'écriture comptable." }}
      blocks={
        <>
          <FacturationBlock reverse={false} />
          <PilotageBlock reverse />
        </>
      }
      aussi={[
        { icone: UserCheck, titre: "Accès du comptable", texte: "Votre comptable consulte vos factures et avoirs émis en lecture seule, avec un journal de ses consultations et exports.", href: "/demo/comptable", lien: "Voir dans la démo" },
        { icone: FileSpreadsheet, titre: "Ventes en CSV", texte: "La liste des ventes de la période, à ouvrir dans un tableur, formules neutralisées.", href: "/glossaire/fec", lien: "Qu'est-ce que le FEC ?" },
        { icone: Archive, titre: "PDF en archive", texte: "Les PDF de vos factures et avoirs de la période, réunis dans un fichier ZIP.", href: "/guide/conservation-factures", lien: "Combien de temps conserver ses factures" },
      ]}
      etapes={{
        titre: "Votre clôture,",
        accent: "en quatre gestes.",
        items: [
          { titre: "Vous facturez", texte: "Chaque facture émise reçoit un numéro à la suite ; une erreur se corrige par un avoir." },
          { titre: "Vous choisissez la période", texte: "Une date de début et une date de fin, dans Paramètres › Exports : le mois, le trimestre ou l'exercice." },
          { titre: "Vous exportez", texte: "Le fichier FEC se télécharge, nommé selon la règle : SIREN, FEC, date de clôture." },
          { titre: "Votre comptable l'importe", texte: "Dans son logiciel, avec vos achats et votre banque. Ou il le récupère lui-même par son accès." },
        ],
      }}
      inlineCta={{ title: "Vos ventes au format du fisc,", accent: "sans ressaisie." }}
      limites={{
        title: "Ce que l'export",
        accent: "ne couvre pas.",
        paragraphes: [
          "Le FEC de Qonforme contient vos ventes et vos avoirs. Il ne contient ni vos achats, ni vos relevés bancaires, ni vos règlements, ni vos salaires : il ne remplace pas la comptabilité tenue par votre expert-comptable.",
          "Les comptes utilisés sont ceux d'une entreprise de prestations de services (706) : si votre comptable utilise d'autres numéros, il les reprend à l'import.",
        ],
      }}
      faq={FAQ}
      liens={[
        { href: "/glossaire/fec", label: "Le FEC en une définition" },
        { href: "/guide/conservation-factures", label: "Conservation des factures" },
        { href: "/guide/avoir-facture", label: "Corriger une facture par un avoir" },
        { href: "/logiciel-relance-factures-impayees", label: "Relance des factures impayées" },
        { href: "/pricing", label: "Tarifs et formules" },
      ]}
      sources={[
        { label: "Livre des procédures fiscales, article L47 A-I (remise du FEC)" },
        { label: "Arrêté du 29 juillet 2013 portant modification des dispositions de l'article A47 A-1 du livre des procédures fiscales (format du fichier)" },
        { label: "Code général des impôts, article 1729 D (sanction)" },
      ]}
      cta={{ title: "Facturez avec Qonforme,", accent: "exportez pour votre comptable." }}
    >
      <section aria-labelledby="contenu-fec" className="px-4 pt-16 sm:px-6 sm:pt-20">
        <div className={WRAP}>
          <SectionHeading id="contenu-fec" title="Ce que contient" accent="le fichier." sub="Tous les exports FEC ne se valent pas : voici exactement ce que met Qonforme dans le vôtre." className="mb-8" />
          <dl data-reveal="" className="grid gap-px overflow-hidden rounded-[20px] border border-q-line bg-q-line shadow-[shadow:var(--q-shadow-card)] md:grid-cols-[220px_1fr]">
            {CONTENU.map(([terme, texte]) => (
              <div key={terme} className="contents">
                <dt className="bg-q-surface-2 px-5 py-4 text-[14px] font-semibold text-q-ink-strong md:py-5">{terme}</dt>
                <dd className="bg-q-surface px-5 pb-4 text-[15px] leading-[1.6] text-q-text-3 md:py-5">{fr(texte)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </ProductPage>
  )
}
