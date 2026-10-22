import { LegalLayout } from "@/components/legal/LegalLayout"
import { CookieSettingsLink } from "@/components/consent/CookieSettingsLink"
import type { Metadata } from "next"
import { PUBLISHER } from "@/lib/legal/publisher"

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Politique de confidentialité de Qonforme : données collectées, finalités, durée de conservation, sous-traitants, cookies et vos droits sur vos données.",
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
      lastUpdated="19 octobre 2026"
    >
      <h2>1. Responsable du traitement</h2>
      <p>
        Le responsable du traitement des données personnelles collectées sur le site <strong>qonforme.fr</strong> est
        la société <strong>{PUBLISHER.name}</strong>, {PUBLISHER.form}, qui exploite le service sous la marque
        Qonforme. Elle est joignable à l&apos;adresse{" "}
        <a href={`mailto:${PUBLISHER.privacyEmail}`}>{PUBLISHER.privacyEmail}</a>.
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
        <li>Votre choix de cookies (accepté ou refusé), conservé sur votre appareil</li>
        <li>
          Seulement si vous acceptez les cookies : identifiant de navigateur et évènements de navigation transmis à
          nos outils de mesure d&apos;audience et de publicité (section 8)
        </li>
      </ul>

      <h2>3. Finalités du traitement</h2>
      <p>Les données sont traitées pour les finalités suivantes :</p>
      <ul>
        <li><strong>Exécution du contrat</strong> — fourniture du service de facturation électronique (création de compte, génération de documents, envoi d&apos;e-mails transactionnels)</li>
        <li><strong>Obligation légale</strong> — archivage des documents comptables pendant 10 ans (article L.123-22 du Code de commerce)</li>
        <li><strong>Intérêt légitime</strong> — sécurité du service, prévention de la fraude, amélioration du produit</li>
        <li><strong>Intérêt légitime</strong> — conseils de démarrage par e-mail pendant les 30 jours qui suivent la création du compte (premier devis, passage du devis à la facture, formule Essentiel). Chaque e-mail contient un lien pour ne plus les recevoir, sans connexion ; le réglage existe aussi dans Paramètres › Relances (article L34-5 du Code des postes et des communications électroniques)</li>
        <li><strong>Gestion des abonnements</strong> — traitement des paiements via Stripe</li>
        <li><strong>Consentement</strong> — mesure de la fréquentation du site et de l&apos;efficacité de nos annonces publicitaires (pixel Meta, mesure d&apos;audience), seulement si vous acceptez les cookies</li>
      </ul>

      <h2>4. Base légale</h2>
      <p>
        Le traitement des données repose sur l&apos;exécution du contrat (article 6.1.b du RGPD) pour la fourniture du
        service, sur l&apos;obligation légale (article 6.1.c) pour l&apos;archivage comptable, et sur l&apos;intérêt légitime
        (article 6.1.f) pour la sécurité et l&apos;amélioration du service. Les cookies et traceurs qui ne sont pas
        strictement nécessaires (publicité, mesure d&apos;audience) reposent sur votre consentement (article 6.1.a du
        RGPD et article 82 de la loi Informatique et Libertés), que vous pouvez retirer à tout moment.
      </p>

      <h2>5. Durée de conservation</h2>
      <ul>
        <li><strong>Données du compte</strong> — conservées pendant toute la durée de l&apos;abonnement, puis 3 ans après la suppression du compte</li>
        <li><strong>Documents comptables</strong> (factures, avoirs) — 10 ans conformément au Code de commerce</li>
        <li><strong>Logs de connexion</strong> — 12 mois</li>
        <li><strong>Votre choix de cookies</strong> — 6 mois sur votre appareil, puis il vous est redemandé</li>
        <li><strong>Cookies du pixel Meta</strong> — 90 jours au plus, et seulement si vous avez accepté</li>
        <li><strong>Enregistrements de parcours (PostHog)</strong> — 30 jours au plus, et seulement si vous avez accepté</li>
        <li><strong>Données de paiement</strong> — conservées par Stripe selon sa propre politique de conservation</li>
      </ul>

      <h2>6. Sous-traitants</h2>
      <p>
        Qonforme fait appel aux sous-traitants suivants pour la fourniture du service.
        Un accord de traitement des données (DPA) conforme à l&apos;article 28 du RGPD est en place avec chacun d&apos;entre eux.
      </p>
      <ul>
        <li><strong>Supabase Inc.</strong> — hébergement de la base de données (région eu-west-3, Paris, France)</li>
        <li><strong>Vercel Inc.</strong> — hébergement de l&apos;application web et mesure de fréquentation (Vercel Web Analytics : pages vues, pays, type d&apos;appareil, sans cookie ni identifiant persistant)</li>
        <li><strong>Stripe Inc.</strong> — traitement des paiements (certifié PCI-DSS)</li>
        <li><strong>Google LLC</strong> — connexion et inscription avec Google, à votre initiative seulement : Google transmet à Qonforme votre adresse email, votre prénom et votre nom ; Qonforme ne reçoit pas votre mot de passe Google</li>
        <li><strong>Resend Inc.</strong> — envoi d&apos;e-mails transactionnels (factures, relances, bienvenue)</li>
        <li><strong>PostHog Inc.</strong> — mesure d&apos;audience (pages vues, provenance des visites) et enregistrement des parcours (voir section 8), chargés seulement si vous acceptez les cookies</li>
        <li><strong>Sentry (Functional Software Inc.)</strong> — surveillance des erreurs techniques et stabilité du service</li>
        <li><strong>Google LLC (Gemini API)</strong> — génération de contenu éditorial pour le blog (aucune donnée utilisateur transmise)</li>
      </ul>
      <p>
        Aucun de ces sous-traitants n&apos;est autorisé à utiliser vos données à des fins propres.
        Les données sont hébergées en Europe (Supabase — France) ou aux États-Unis avec des garanties
        adéquates (clauses contractuelles types de la Commission européenne).
      </p>

      <h3>Partenaire publicitaire (avec votre accord seulement)</h3>
      <p>
        <strong>Meta Platforms Ireland Limited</strong> (Dublin, Irlande) reçoit les données du pixel Meta décrit en
        section 8, si vous acceptez les cookies. Meta n&apos;agit pas comme sous-traitant de Qonforme pour ces données :
        Meta et Qonforme sont responsables conjoints de leur collecte et de leur transmission à Meta, selon l&apos;
        <a href="https://www.facebook.com/legal/controller_addendum" target="_blank" rel="noopener noreferrer">addendum
        de Meta</a>. L&apos;utilisation que Meta en fait ensuite relève de sa{" "}
        <a href="https://www.facebook.com/privacy/policy" target="_blank" rel="noopener noreferrer">politique de confidentialité</a>.
      </p>

      <h2>7. Transferts hors UE</h2>
      <p>
        Le responsable du traitement, {PUBLISHER.name}, est lui-même établi aux États-Unis. Certains sous-traitants
        (Vercel, Stripe, Resend) le sont aussi. Les transferts de données
        sont encadrés par le EU-US Data Privacy Framework et/ou les clauses contractuelles types adoptées par la
        Commission européenne, garantissant un niveau de protection adéquat. Si vous acceptez les cookies, Meta peut
        aussi transférer des données vers les États-Unis, dans les conditions décrites dans sa politique de
        confidentialité.
      </p>

      <h2 id="cookies">8. Cookies et traceurs</h2>
      <p>
        Qonforme distingue deux catégories. La première ne demande pas votre accord. Pour la seconde, vous choisissez
        avec le bandeau affiché à votre première visite : <strong>accepter</strong> ou <strong>refuser</strong>, avec le
        même effort. Ne pas répondre équivaut à refuser. Vous pouvez modifier votre choix à tout moment :{" "}
        <CookieSettingsLink className="font-medium text-q-accent-strong underline underline-offset-2 hover:no-underline" />.
      </p>

      <h3>8.1 Strictement nécessaires (sans consentement)</h3>
      <ul>
        <li><strong>Cookie de session</strong> — authentification Supabase (durée : session)</li>
        <li><strong>Préférence de thème</strong> — stockage local (localStorage, clé &laquo;&nbsp;theme&nbsp;&raquo;)</li>
        <li><strong>Votre choix de cookies</strong> — stockage local (localStorage, clé &laquo;&nbsp;qonforme-cookie-consent&nbsp;&raquo;), 6 mois</li>
        <li><strong>Paiement</strong> — Stripe peut déposer des cookies de sécurité et de prévention de la fraude au moment de régler un abonnement</li>
      </ul>

      <h3>8.2 Soumis à votre accord</h3>
      <ul>
        <li>
          <strong>Pixel Meta</strong> (Meta Platforms Ireland Limited) — cookies <code>_fbp</code> et <code>_fbc</code>,
          90 jours au plus. Finalités : mesurer l&apos;efficacité de nos annonces et les présenter à des personnes qui
          ont déjà visité le site. Données transmises à Meta : l&apos;adresse de la page, le type d&apos;action (visite,
          consultation des tarifs, de la démo ou des outils gratuits, création de compte, entreprise renseignée,
          début de paiement, abonnement, génération d&apos;un document avec l&apos;outil gratuit), le montant et la
          devise d&apos;un abonnement, votre adresse IP, votre navigateur et l&apos;identifiant du cookie.
        </li>
        <li>
          <strong>PostHog</strong> — mesure d&apos;audience (pages vues, provenance des visites, quelques actions clés
          comme l&apos;affichage du mur de paiement ou le choix d&apos;une formule, sans aucune donnée de vos documents) et enregistrement de
          vos parcours (clics, défilement, pages visitées, comme une vidéo de la navigation), pour repérer ce qui
          bloque les utilisateurs et améliorer le service. Un identifiant est alors enregistré dans votre navigateur.
          L&apos;enregistrement masque tous les champs de saisie ; dans l&apos;application, il masque aussi les
          textes affichés (noms de clients, montants, numéros de documents) : seuls les libellés d&apos;interface
          restent lisibles. Il n&apos;est jamais actif sur les pages publiques de règlement ou de signature. Les
          enregistrements sont conservés 30 jours au plus, sont consultés par l&apos;équipe de Qonforme seulement,
          et ne servent ni à la publicité ni à du profilage.
        </li>
      </ul>
      <p>
        <strong>Sans votre accord, ces outils ne sont pas chargés</strong> : aucun cookie ni identifiant n&apos;est déposé
        et aucune donnée ne leur est transmise. Si vous refusez ou retirez votre accord, les cookies Meta existants sont
        supprimés. Ces outils ne sont jamais chargés sur les pages destinées aux clients de nos utilisateurs (règlement
        d&apos;une facture, signature d&apos;un devis) ni dans l&apos;espace d&apos;administration.
      </p>
      <p>
        Votre choix est conservé six mois sur votre appareil, puis nous vous le redemandons. Vous pouvez aussi
        paramétrer votre navigateur pour bloquer ou supprimer les cookies ; certaines parties du service (connexion)
        ne fonctionnent pas sans les cookies de la première catégorie.
      </p>

      <h3>8.3 Sans cookie</h3>
      <p>
        <strong>Vercel Web Analytics</strong> mesure la fréquentation sans cookie et sans identifiant persistant.{" "}
        <strong>Sentry</strong> sert uniquement à détecter et corriger les erreurs techniques ; dans l&apos;application
        (hors pages de contenu), une erreur peut déclencher l&apos;enregistrement de la session, dont les textes et les
        champs de saisie sont masqués par défaut.
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
        <li><strong>Retrait du consentement</strong> — à tout moment, avec le lien &laquo;&nbsp;Gérer les cookies&nbsp;&raquo; du pied de page, sans effet sur ce qui s&apos;est passé avant</li>
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
