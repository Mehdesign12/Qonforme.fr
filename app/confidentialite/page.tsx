import { LegalLayout } from "@/components/legal/LegalLayout"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Politique de confidentialité de Qonforme — traitement des données personnelles, droits RGPD, cookies et sous-traitants.",
  alternates: { canonical: "/confidentialite" },
  openGraph: {
    images: [{ url: "/api/og?title=Politique%20de%20confidentialit%C3%A9&subtitle=Traitement%20des%20donn%C3%A9es%20personnelles%20et%20droits%20RGPD", width: 1200, height: 630 }],
  },
}

export default function ConfidentialitePage() {
  return (
    <LegalLayout
      title="Politique de"
      titleAccent="confidentialité"
      path="/confidentialite"
      subtitle="Comment Qonforme collecte, utilise et protège vos données personnelles."
      lastUpdated="12 avril 2026"
    >
      <h2>1. Responsable du traitement</h2>
      <p>
        Le responsable du traitement des données personnelles collectées sur le site <strong>qonforme.fr</strong> est
        la société <strong>Qonforme SAS</strong>, joignable à l&apos;adresse{" "}
        <a href="mailto:privacy@qonforme.fr">privacy@qonforme.fr</a>.
      </p>

      <h2>2. Données collectées</h2>
      <p>
        Qonforme collecte les données strictement nécessaires à la fourniture du service de facturation électronique :
      </p>

      <h3>2.1 Données d&apos;identification</h3>
      <ul>
        <li>Adresse e-mail</li>
        <li>Mot de passe (stocké sous forme de hash, jamais en clair)</li>
      </ul>

      <h3>2.2 Données professionnelles</h3>
      <ul>
        <li>Dénomination sociale, SIREN, SIRET, numéro de TVA intracommunautaire</li>
        <li>Adresse du siège social</li>
        <li>IBAN (pour mention sur les factures émises)</li>
        <li>Logo d&apos;entreprise (optionnel)</li>
      </ul>

      <h3>2.3 Données de facturation</h3>
      <ul>
        <li>Factures, devis, bons de commande et avoirs créés par l&apos;Utilisateur</li>
        <li>Coordonnées des clients de l&apos;Utilisateur</li>
        <li>Historique des transactions et paiements (géré par Stripe)</li>
      </ul>

      <h3>2.4 Données techniques</h3>
      <ul>
        <li>Logs de connexion (adresse IP, date, heure)</li>
        <li>Préférences d&apos;interface (thème sombre/clair)</li>
      </ul>

      <h2>3. Finalités du traitement</h2>
      <p>Les données sont traitées pour les finalités suivantes :</p>
      <ul>
        <li><strong>Exécution du contrat</strong> — fourniture du service de facturation électronique (création de compte, génération de documents, envoi d&apos;e-mails transactionnels)</li>
        <li><strong>Obligation légale</strong> — archivage des documents comptables pendant 10 ans (article L.123-22 du Code de commerce)</li>
        <li><strong>Intérêt légitime</strong> — sécurité du service, prévention de la fraude, amélioration du produit</li>
        <li><strong>Gestion des abonnements</strong> — traitement des paiements via Stripe</li>
      </ul>

      <h2>4. Base légale</h2>
      <p>
        Le traitement des données repose sur l&apos;exécution du contrat (article 6.1.b du RGPD) pour la fourniture du
        service, sur l&apos;obligation légale (article 6.1.c) pour l&apos;archivage comptable, et sur l&apos;intérêt légitime
        (article 6.1.f) pour la sécurité et l&apos;amélioration du service.
      </p>

      <h2>5. Durée de conservation</h2>
      <ul>
        <li><strong>Données du compte</strong> — conservées pendant toute la durée de l&apos;abonnement, puis 3 ans après la suppression du compte</li>
        <li><strong>Documents comptables</strong> (factures, avoirs) — 10 ans conformément au Code de commerce</li>
        <li><strong>Logs de connexion</strong> — 12 mois</li>
        <li><strong>Données de paiement</strong> — conservées par Stripe selon sa propre politique de conservation</li>
      </ul>

      <h2>6. Sous-traitants</h2>
      <p>
        Qonforme fait appel aux sous-traitants suivants pour la fourniture du service.
        Un accord de traitement des données (DPA) conforme à l&apos;article 28 du RGPD est en place avec chacun d&apos;entre eux.
      </p>
      <ul>
        <li><strong>Supabase Inc.</strong> — hébergement de la base de données (région eu-west-3, Paris, France)</li>
        <li><strong>Vercel Inc.</strong> — hébergement de l&apos;application web</li>
        <li><strong>Stripe Inc.</strong> — traitement des paiements (certifié PCI-DSS)</li>
        <li><strong>Resend Inc.</strong> — envoi d&apos;e-mails transactionnels (factures, relances, bienvenue)</li>
        <li><strong>PostHog Inc.</strong> — mesure d&apos;audience anonymisée (aucun profil individuel créé, pas de cookie publicitaire)</li>
        <li><strong>Sentry (Functional Software Inc.)</strong> — surveillance des erreurs techniques et stabilité du service</li>
        <li><strong>Google LLC (Gemini API)</strong> — génération de contenu éditorial pour le blog (aucune donnée utilisateur transmise)</li>
      </ul>
      <p>
        Aucun de ces sous-traitants n&apos;est autorisé à utiliser vos données à des fins propres.
        Les données sont hébergées en Europe (Supabase — France) ou aux États-Unis avec des garanties
        adéquates (clauses contractuelles types de la Commission européenne).
      </p>

      <h2>7. Transferts hors UE</h2>
      <p>
        Certains sous-traitants (Vercel, Stripe, Resend) sont établis aux États-Unis. Les transferts de données
        sont encadrés par le EU-US Data Privacy Framework et/ou les clauses contractuelles types adoptées par la
        Commission européenne, garantissant un niveau de protection adéquat.
      </p>

      <h2>8. Cookies</h2>
      <p>
        Qonforme utilise exclusivement des <strong>cookies strictement nécessaires</strong> au fonctionnement du service :
      </p>
      <ul>
        <li><strong>Cookie de session</strong> — authentification Supabase (durée : session)</li>
        <li><strong>Préférence de thème</strong> — stockage local (localStorage, clé &laquo;theme&raquo;)</li>
      </ul>
      <p>
        <strong>Aucun cookie publicitaire ou de traçage n&apos;est déposé.</strong> Qonforme
        n&apos;utilise ni Google Analytics, ni Facebook Pixel, ni aucun outil de tracking publicitaire.
      </p>
      <p>
        Qonforme utilise <strong>PostHog</strong> pour la mesure d&apos;audience anonymisée (pages vues, sources de trafic).
        Cet outil fonctionne <strong>sans création de profil individuel</strong> (mode &laquo;&nbsp;identified_only&nbsp;&raquo;)
        et sans dépôt de cookie publicitaire. Les données collectées sont agrégées et ne permettent pas
        d&apos;identifier personnellement un visiteur. Cette mesure d&apos;audience est exemptée de consentement
        conformément aux recommandations de la CNIL (délibération n° 2020-091).
      </p>
      <p>
        <strong>Sentry</strong> est utilisé pour la détection automatique des erreurs techniques.
        Il ne collecte aucune donnée personnelle identifiante et fonctionne exclusivement pour assurer
        la stabilité du service.
      </p>

      <h2>9. Vos droits</h2>
      <p>
        Conformément au Règlement (UE) 2016/679 (RGPD), vous disposez des droits suivants :
      </p>
      <ul>
        <li><strong>Droit d&apos;accès</strong> — obtenir la confirmation que vos données sont traitées et en recevoir une copie</li>
        <li><strong>Droit de rectification</strong> — corriger des données inexactes ou incomplètes</li>
        <li><strong>Droit à l&apos;effacement</strong> — demander la suppression de vos données (sous réserve des obligations légales d&apos;archivage)</li>
        <li><strong>Droit à la portabilité</strong> — recevoir vos données dans un format structuré et lisible (export FEC disponible)</li>
        <li><strong>Droit d&apos;opposition</strong> — vous opposer au traitement fondé sur l&apos;intérêt légitime</li>
        <li><strong>Droit à la limitation</strong> — restreindre temporairement le traitement de vos données</li>
      </ul>
      <p>
        Pour exercer ces droits, contactez-nous à <a href="mailto:privacy@qonforme.fr">privacy@qonforme.fr</a>.
        Nous répondrons dans un délai de 30 jours. En cas de réclamation, vous pouvez saisir la{" "}
        <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">CNIL</a>.
      </p>

      <h2>10. Sécurité</h2>
      <p>Qonforme met en œuvre les mesures de sécurité suivantes :</p>
      <ul>
        <li>Chiffrement TLS sur toutes les communications</li>
        <li>Mots de passe hashés (bcrypt via Supabase Auth)</li>
        <li>Accès aux données restreint par Row Level Security (RLS) — chaque utilisateur n&apos;accède qu&apos;à ses propres données</li>
        <li>Paiements sécurisés via Stripe (certifié PCI-DSS)</li>
        <li>Middleware d&apos;authentification sur toutes les routes protégées</li>
      </ul>

      <h2>11. Modification de cette politique</h2>
      <p>
        Qonforme se réserve le droit de modifier la présente politique de confidentialité à tout moment. En cas de
        modification substantielle, l&apos;Utilisateur sera notifié par e-mail ou via l&apos;application. La date de dernière
        mise à jour est indiquée en haut de cette page.
      </p>

      <h2>12. Contact</h2>
      <p>
        Pour toute question relative à cette politique :{" "}
        <a href="mailto:privacy@qonforme.fr">privacy@qonforme.fr</a>
      </p>
    </LegalLayout>
  )
}
