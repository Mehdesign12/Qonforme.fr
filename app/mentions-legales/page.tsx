import { LegalLayout } from "@/components/legal/LegalLayout"
import type { Metadata } from "next"
import { PUBLISHER } from "@/lib/legal/publisher"

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Mentions légales du site Qonforme : éditeur, hébergement, propriété intellectuelle, données personnelles, cookies, liens et droit applicable.",
  alternates: { canonical: "/mentions-legales" },
}

export default function MentionsLegalesPage() {
  return (
    <LegalLayout
      title="Mentions"
      titleAccent="légales"
      path="/mentions-legales"
      subtitle="Informations légales obligatoires conformément à la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique (LCEN)."
      lastUpdated="19 octobre 2026"
    >
      <h2>1. Éditeur du site</h2>
      <p>
        Le site <strong>qonforme.fr</strong> est édité par la société <strong>{PUBLISHER.name}</strong>,{" "}
        {PUBLISHER.form}. Elle exploite le service sous la marque <strong>Qonforme</strong>, qui n&apos;est pas une
        société distincte.
      </p>
      <ul>
        <li><strong>Société :</strong> {PUBLISHER.name}</li>
        {PUBLISHER.address && <li><strong>Siège social :</strong> {PUBLISHER.address}</li>}
        {PUBLISHER.manager && <li><strong>Directeur de la publication :</strong> {PUBLISHER.manager}</li>}
        <li><strong>Contact :</strong> <a href={`mailto:${PUBLISHER.contactEmail}`}>{PUBLISHER.contactEmail}</a></li>
      </ul>

      <h2>2. Hébergement</h2>

      <h3>Vercel Inc. — hébergement applicatif</h3>
      <ul>
        <li><strong>Adresse :</strong> 340 Pine Street, Suite 701, San Francisco, CA 94104, États-Unis</li>
        <li><strong>Site web :</strong> <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">vercel.com</a></li>
      </ul>

      <h3>Supabase Inc. — base de données</h3>
      <ul>
        <li><strong>Site web :</strong> <a href="https://supabase.com" target="_blank" rel="noopener noreferrer">supabase.com</a></li>
        <li>Données stockées dans la région <strong>eu-west-3 (Paris, France)</strong></li>
      </ul>

      <h2>3. Propriété intellectuelle</h2>
      <p>
        L&apos;ensemble des contenus présents sur le site qonforme.fr (textes, images, logos, icônes, code source, interface
        graphique) est la propriété exclusive de {PUBLISHER.name} ou de ses partenaires, et est protégé par les lois françaises
        et internationales relatives à la propriété intellectuelle.
      </p>
      <p>
        Toute reproduction, représentation, modification ou utilisation non autorisée de ces éléments est interdite et
        constitue une contrefaçon sanctionnée par les articles L.335-2 et suivants du Code de la propriété intellectuelle.
      </p>

      <h2>4. Protection des données personnelles</h2>
      <p>
        {PUBLISHER.name} est responsable du traitement des données personnelles collectées sur le site, conformément au
        Règlement (UE) 2016/679 (RGPD) et à la loi n° 78-17 du 6 janvier 1978 modifiée.
      </p>

      <h3>Données collectées</h3>
      <ul>
        <li>Données d&apos;identification : nom, prénom, adresse e-mail</li>
        <li>Données professionnelles : dénomination sociale, SIREN/SIRET, numéro de TVA, adresse</li>
        <li>Données de paiement : traitées par Stripe (certifié PCI-DSS), non stockées chez Qonforme</li>
        <li>Données d&apos;utilisation : logs de connexion, actions dans l&apos;application</li>
      </ul>

      <h3>Finalités du traitement</h3>
      <ul>
        <li>Fourniture du service de facturation électronique</li>
        <li>Gestion des abonnements</li>
        <li>Envoi d&apos;e-mails transactionnels liés au service</li>
        <li>Archivage légal des documents comptables (10 ans)</li>
      </ul>

      <h3>Vos droits</h3>
      <p>
        Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de portabilité,
        d&apos;opposition et de limitation du traitement de vos données.
        Ces droits s&apos;exercent à <a href="mailto:privacy@qonforme.fr">privacy@qonforme.fr</a>.
        En cas de réclamation non résolue, vous pouvez saisir la <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">CNIL</a>.
      </p>

      <h3>Sous-traitants</h3>
      <ul>
        <li><strong>Supabase</strong> — stockage des données (hébergé en France)</li>
        <li><strong>Stripe</strong> — paiements (certifié PCI-DSS)</li>
        <li><strong>Resend</strong> — e-mails transactionnels</li>
        <li><strong>Vercel</strong> — hébergement applicatif</li>
      </ul>

      <h2>5. Cookies</h2>
      <p>
        Qonforme utilise des cookies strictement nécessaires au fonctionnement du service (session d&apos;authentification,
        préférences de thème). Les cookies publicitaires et de mesure d&apos;audience (pixel Meta, PostHog) ne sont
        déposés qu&apos;avec votre accord, que vous pouvez refuser ou retirer à tout moment. Le détail figure dans la{" "}
        <a href="/confidentialite#cookies">politique de confidentialité</a>.
      </p>

      <h2>6. Liens hypertextes</h2>
      <p>
        Le site peut contenir des liens vers des sites tiers. Qonforme n&apos;exerce aucun contrôle sur ces sites et
        décline toute responsabilité quant à leur contenu ou leur politique de confidentialité.
      </p>

      <h2>7. Limitation de responsabilité</h2>
      <p>
        Qonforme s&apos;efforce d&apos;assurer l&apos;exactitude des informations publiées mais ne peut en garantir l&apos;exhaustivité.
        Qonforme ne saurait être tenu responsable des dommages directs ou indirects résultant de l&apos;utilisation du site
        ou de l&apos;impossibilité d&apos;y accéder.
      </p>

      <h2>8. Droit applicable</h2>
      <p>
        Les présentes mentions légales sont soumises au droit français. En cas de litige, et à défaut de résolution
        amiable, les tribunaux français seront seuls compétents.
      </p>

      <h2>9. Contact</h2>
      <p>
        Pour toute question : <a href="mailto:contact@qonforme.fr">contact@qonforme.fr</a>
      </p>
    </LegalLayout>
  )
}
