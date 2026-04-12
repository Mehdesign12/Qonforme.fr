import { LegalLayout } from "@/components/legal/LegalLayout"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Politique de confidentialit\u00e9",
  description: "Politique de confidentialit\u00e9 de Qonforme \u2014 traitement des donn\u00e9es personnelles, droits RGPD, cookies et sous-traitants.",
  alternates: { canonical: "/confidentialite" },
  openGraph: {
    images: [{ url: "/api/og?title=Politique%20de%20confidentialit%C3%A9&subtitle=Traitement%20des%20donn%C3%A9es%20personnelles%20et%20droits%20RGPD", width: 1200, height: 630 }],
  },
}

export default function ConfidentialitePage() {
  return (
    <LegalLayout
      title="Politique de confidentialit\u00e9"
      subtitle="Comment Qonforme collecte, utilise et prot\u00e8ge vos donn\u00e9es personnelles."
      lastUpdated="12 avril 2026"
    >
      <h2>1. Responsable du traitement</h2>
      <p>
        Le responsable du traitement des donn&apos;\u00e9es personnelles collect\u00e9es sur le site <strong>qonforme.fr</strong> est
        la soci\u00e9t\u00e9 <strong>Qonforme SAS</strong>, joignable \u00e0 l&apos;adresse{" "}
        <a href="mailto:privacy@qonforme.fr">privacy@qonforme.fr</a>.
      </p>

      <h2>2. Donn\u00e9es collect\u00e9es</h2>
      <p>
        Qonforme collecte les donn\u00e9es strictement n\u00e9cessaires \u00e0 la fourniture du service de facturation \u00e9lectronique :
      </p>

      <h3>2.1 Donn\u00e9es d&apos;identification</h3>
      <ul>
        <li>Adresse e-mail</li>
        <li>Mot de passe (stock\u00e9 sous forme de hash, jamais en clair)</li>
      </ul>

      <h3>2.2 Donn\u00e9es professionnelles</h3>
      <ul>
        <li>D\u00e9nomination sociale, SIREN, SIRET, num\u00e9ro de TVA intracommunautaire</li>
        <li>Adresse du si\u00e8ge social</li>
        <li>IBAN (pour mention sur les factures \u00e9mises)</li>
        <li>Logo d&apos;entreprise (optionnel)</li>
      </ul>

      <h3>2.3 Donn\u00e9es de facturation</h3>
      <ul>
        <li>Factures, devis, bons de commande et avoirs cr\u00e9\u00e9s par l&apos;Utilisateur</li>
        <li>Coordonn\u00e9es des clients de l&apos;Utilisateur</li>
        <li>Historique des transactions et paiements (g\u00e9r\u00e9 par Stripe)</li>
      </ul>

      <h3>2.4 Donn\u00e9es techniques</h3>
      <ul>
        <li>Logs de connexion (adresse IP, date, heure)</li>
        <li>Pr\u00e9f\u00e9rences d&apos;interface (th\u00e8me sombre/clair)</li>
      </ul>

      <h2>3. Finalit\u00e9s du traitement</h2>
      <p>Les donn\u00e9es sont trait\u00e9es pour les finalit\u00e9s suivantes :</p>
      <ul>
        <li><strong>Ex\u00e9cution du contrat</strong> \u2014 fourniture du service de facturation \u00e9lectronique (cr\u00e9ation de compte, g\u00e9n\u00e9ration de documents, envoi d&apos;e-mails transactionnels)</li>
        <li><strong>Obligation l\u00e9gale</strong> \u2014 archivage des documents comptables pendant 10 ans (article L.123-22 du Code de commerce)</li>
        <li><strong>Int\u00e9r\u00eat l\u00e9gitime</strong> \u2014 s\u00e9curit\u00e9 du service, pr\u00e9vention de la fraude, am\u00e9lioration du produit</li>
        <li><strong>Gestion des abonnements</strong> \u2014 traitement des paiements via Stripe</li>
      </ul>

      <h2>4. Base l\u00e9gale</h2>
      <p>
        Le traitement des donn\u00e9es repose sur l&apos;ex\u00e9cution du contrat (article 6.1.b du RGPD) pour la fourniture du
        service, sur l&apos;obligation l\u00e9gale (article 6.1.c) pour l&apos;archivage comptable, et sur l&apos;int\u00e9r\u00eat l\u00e9gitime
        (article 6.1.f) pour la s\u00e9curit\u00e9 et l&apos;am\u00e9lioration du service.
      </p>

      <h2>5. Dur\u00e9e de conservation</h2>
      <ul>
        <li><strong>Donn\u00e9es du compte</strong> \u2014 conserv\u00e9es pendant toute la dur\u00e9e de l&apos;abonnement, puis 3 ans apr\u00e8s la suppression du compte</li>
        <li><strong>Documents comptables</strong> (factures, avoirs) \u2014 10 ans conform\u00e9ment au Code de commerce</li>
        <li><strong>Logs de connexion</strong> \u2014 12 mois</li>
        <li><strong>Donn\u00e9es de paiement</strong> \u2014 conserv\u00e9es par Stripe selon sa propre politique de conservation</li>
      </ul>

      <h2>6. Sous-traitants</h2>
      <p>
        Qonforme fait appel aux sous-traitants suivants pour la fourniture du service.
        Un accord de traitement des donn\u00e9es (DPA) conforme \u00e0 l&apos;article 28 du RGPD est en place avec chacun d&apos;entre eux.
      </p>
      <ul>
        <li><strong>Supabase Inc.</strong> \u2014 h\u00e9bergement de la base de donn\u00e9es (r\u00e9gion eu-west-3, Paris, France)</li>
        <li><strong>Vercel Inc.</strong> \u2014 h\u00e9bergement de l&apos;application web</li>
        <li><strong>Stripe Inc.</strong> \u2014 traitement des paiements (certifi\u00e9 PCI-DSS)</li>
        <li><strong>Resend Inc.</strong> \u2014 envoi d&apos;e-mails transactionnels (factures, relances, bienvenue)</li>
        <li><strong>PostHog Inc.</strong> \u2014 mesure d&apos;audience anonymis\u00e9e (aucun profil individuel cr\u00e9\u00e9, pas de cookie publicitaire)</li>
        <li><strong>Sentry (Functional Software Inc.)</strong> \u2014 surveillance des erreurs techniques et stabilit\u00e9 du service</li>
        <li><strong>Google LLC (Gemini API)</strong> \u2014 g\u00e9n\u00e9ration de contenu \u00e9ditorial pour le blog (aucune donn\u00e9e utilisateur transmise)</li>
      </ul>
      <p>
        Aucun de ces sous-traitants n&apos;est autoris\u00e9 \u00e0 utiliser vos donn\u00e9es \u00e0 des fins propres.
        Les donn\u00e9es sont h\u00e9berg\u00e9es en Europe (Supabase \u2014 France) ou aux \u00c9tats-Unis avec des garanties
        ad\u00e9quates (clauses contractuelles types de la Commission europ\u00e9enne).
      </p>

      <h2>7. Transferts hors UE</h2>
      <p>
        Certains sous-traitants (Vercel, Stripe, Resend) sont \u00e9tablis aux \u00c9tats-Unis. Les transferts de donn\u00e9es
        sont encadr\u00e9s par le EU-US Data Privacy Framework et/ou les clauses contractuelles types adopt\u00e9es par la
        Commission europ\u00e9enne, garantissant un niveau de protection ad\u00e9quat.
      </p>

      <h2>8. Cookies</h2>
      <p>
        Qonforme utilise exclusivement des <strong>cookies strictement n\u00e9cessaires</strong> au fonctionnement du service :
      </p>
      <ul>
        <li><strong>Cookie de session</strong> \u2014 authentification Supabase (dur\u00e9e : session)</li>
        <li><strong>Pr\u00e9f\u00e9rence de th\u00e8me</strong> \u2014 stockage local (localStorage, cl\u00e9 &laquo;theme&raquo;)</li>
      </ul>
      <p>
        <strong>Aucun cookie publicitaire ou de tra\u00e7age n&apos;est d\u00e9pos\u00e9.</strong> Qonforme
        n&apos;utilise ni Google Analytics, ni Facebook Pixel, ni aucun outil de tracking publicitaire.
      </p>
      <p>
        Qonforme utilise <strong>PostHog</strong> pour la mesure d&apos;audience anonymis\u00e9e (pages vues, sources de trafic).
        Cet outil fonctionne <strong>sans cr\u00e9ation de profil individuel</strong> (mode &laquo;&nbsp;identified_only&nbsp;&raquo;)
        et sans d\u00e9p\u00f4t de cookie publicitaire. Les donn\u00e9es collect\u00e9es sont agr\u00e9g\u00e9es et ne permettent pas
        d&apos;identifier personnellement un visiteur. Cette mesure d&apos;audience est exempt\u00e9e de consentement
        conform\u00e9ment aux recommandations de la CNIL (d\u00e9lib\u00e9ration n\u00b0 2020-091).
      </p>
      <p>
        <strong>Sentry</strong> est utilis\u00e9 pour la d\u00e9tection automatique des erreurs techniques.
        Il ne collecte aucune donn\u00e9e personnelle identifiante et fonctionne exclusivement pour assurer
        la stabilit\u00e9 du service.
      </p>

      <h2>9. Vos droits</h2>
      <p>
        Conform\u00e9ment au R\u00e8glement (UE) 2016/679 (RGPD), vous disposez des droits suivants :
      </p>
      <ul>
        <li><strong>Droit d&apos;acc\u00e8s</strong> \u2014 obtenir la confirmation que vos donn\u00e9es sont trait\u00e9es et en recevoir une copie</li>
        <li><strong>Droit de rectification</strong> \u2014 corriger des donn\u00e9es inexactes ou incompl\u00e8tes</li>
        <li><strong>Droit \u00e0 l&apos;effacement</strong> \u2014 demander la suppression de vos donn\u00e9es (sous r\u00e9serve des obligations l\u00e9gales d&apos;archivage)</li>
        <li><strong>Droit \u00e0 la portabilit\u00e9</strong> \u2014 recevoir vos donn\u00e9es dans un format structur\u00e9 et lisible (export FEC disponible)</li>
        <li><strong>Droit d&apos;opposition</strong> \u2014 vous opposer au traitement fond\u00e9 sur l&apos;int\u00e9r\u00eat l\u00e9gitime</li>
        <li><strong>Droit \u00e0 la limitation</strong> \u2014 restreindre temporairement le traitement de vos donn\u00e9es</li>
      </ul>
      <p>
        Pour exercer ces droits, contactez-nous \u00e0 <a href="mailto:privacy@qonforme.fr">privacy@qonforme.fr</a>.
        Nous r\u00e9pondrons dans un d\u00e9lai de 30 jours. En cas de r\u00e9clamation, vous pouvez saisir la{" "}
        <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">CNIL</a>.
      </p>

      <h2>10. S\u00e9curit\u00e9</h2>
      <p>Qonforme met en \u0153uvre les mesures de s\u00e9curit\u00e9 suivantes :</p>
      <ul>
        <li>Chiffrement TLS sur toutes les communications</li>
        <li>Mots de passe hash\u00e9s (bcrypt via Supabase Auth)</li>
        <li>Acc\u00e8s aux donn\u00e9es restreint par Row Level Security (RLS) \u2014 chaque utilisateur n&apos;acc\u00e8de qu&apos;\u00e0 ses propres donn\u00e9es</li>
        <li>Paiements s\u00e9curis\u00e9s via Stripe (certifi\u00e9 PCI-DSS)</li>
        <li>Middleware d&apos;authentification sur toutes les routes prot\u00e9g\u00e9es</li>
      </ul>

      <h2>11. Modification de cette politique</h2>
      <p>
        Qonforme se r\u00e9serve le droit de modifier la pr\u00e9sente politique de confidentialit\u00e9 \u00e0 tout moment. En cas de
        modification substantielle, l&apos;Utilisateur sera notifi\u00e9 par e-mail ou via l&apos;application. La date de derni\u00e8re
        mise \u00e0 jour est indiqu\u00e9e en haut de cette page.
      </p>

      <h2>12. Contact</h2>
      <p>
        Pour toute question relative \u00e0 cette politique :{" "}
        <a href="mailto:privacy@qonforme.fr">privacy@qonforme.fr</a>
      </p>
    </LegalLayout>
  )
}
