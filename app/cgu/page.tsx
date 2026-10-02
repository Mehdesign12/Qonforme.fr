import { LegalLayout } from "@/components/legal/LegalLayout"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation",
  description: "Conditions Générales d'Utilisation du service Qonforme — facturation électronique pour artisans et TPE.",
  alternates: { canonical: "/cgu" },
}

export default function CGUPage() {
  return (
    <LegalLayout
      title="Conditions générales"
      titleAccent="d'utilisation"
      path="/cgu"
      subtitle="Merci de lire attentivement ces conditions avant d'utiliser Qonforme."
      lastUpdated="2 octobre 2026"
    >
      <h2>Article 1 — Objet</h2>
      <p>
        Les présentes Conditions Générales d&apos;Utilisation (ci-après « CGU ») régissent l&apos;accès et l&apos;utilisation
        du service Qonforme (ci-après « le Service »), éditée par la société Qonforme SAS.
        En créant un compte, l&apos;Utilisateur accepte sans réserve les présentes CGU.
      </p>

      <h2>Article 2 — Description du service</h2>
      <p>
        Qonforme est un service SaaS (Software as a Service) de facturation électronique destiné aux artisans,
        micro-entrepreneurs et TPE françaises. Il permet de :
      </p>
      <ul>
        <li>Créer, éditer et envoyer des factures, devis, bons de commande et avoirs</li>
        <li>Générer des factures PDF accompagnées de leurs données structurées Factur-X</li>
        <li>Gérer un portefeuille de clients et un catalogue de produits</li>
        <li>Suivre les encaissements et relancer automatiquement les factures impayées</li>
        <li>Exporter les données comptables au format FEC</li>
      </ul>
      <p>
        Le Service ne constitue pas une Plateforme de Dématérialisation Partenaire (PDP) agréée. La transmission
        effective des factures sur le portail Chorus Pro ou toute autre plateforme agréée reste à la charge de l&apos;Utilisateur,
        avec l&apos;appui du guide fourni dans l&apos;application.
      </p>

      <h2>Article 3 — Création de compte et accès</h2>
      <h3>3.1 Éligibilité</h3>
      <p>
        Le Service est réservé aux personnes physiques ou morales exerçant une activité professionnelle en France,
        assujetties ou non à la TVA, et disposant de la capacité juridique pour contracter.
      </p>
      <h3>3.2 Inscription</h3>
      <p>
        L&apos;Utilisateur crée un compte en fournissant une adresse e-mail valide et un mot de passe sécurisé, puis en
        renseignant les informations de son entreprise (dénomination, SIREN, adresse). L&apos;Utilisateur garantit l&apos;exactitude
        des informations transmises et s&apos;engage à les maintenir à jour.
      </p>
      <h3>3.3 Sécurité du compte</h3>
      <p>
        L&apos;Utilisateur est seul responsable de la confidentialité de ses identifiants. Toute utilisation du Service avec
        ses identifiants est réputée effectuée par lui. En cas de compromission, l&apos;Utilisateur doit notifier Qonforme
        sans délai à <strong>contact@qonforme.fr</strong>.
      </p>

      <h2>Article 4 — Formules, tarifs et facturation</h2>
      <h3>4.1 Formules</h3>
      <ul>
        <li>
          <strong>Version gratuite</strong>, sans limite de durée ni carte bancaire : devis illimités, gestion des clients
          et du catalogue, préparation de factures en brouillon, consultation et téléchargement des documents.
        </li>
        <li>
          <strong>Formule Essentiel</strong> — 12 € HT par mois, ou 120 € HT par an : émission et envoi des factures et
          des avoirs, relances des factures impayées, export comptable.
        </li>
        <li>
          <strong>Formule Artisan</strong> — 24 € HT par mois, ou 240 € HT par an : proposée lorsque ses fonctionnalités
          propres (situations de travaux, retenue de garantie, autoliquidation) seront disponibles.
        </li>
      </ul>
      <p>Les prix s&apos;entendent hors taxes ; la TVA au taux en vigueur (20 %) s&apos;y ajoute.</p>
      <h3>4.2 Paiement</h3>
      <p>
        Le paiement est traité par Stripe, par carte bancaire ou par prélèvement SEPA. L&apos;Utilisateur est débité à la
        souscription, puis automatiquement à chaque échéance (mensuelle ou annuelle). Les factures d&apos;abonnement sont
        disponibles depuis <strong>Paramètres → Abonnement</strong>.
      </p>
      <h3>4.3 Garantie satisfait ou remboursé</h3>
      <p>
        Dans les 30 jours qui suivent son premier paiement, l&apos;Utilisateur peut obtenir le remboursement intégral des
        sommes versées, sans avoir à se justifier, depuis <strong>Paramètres → Abonnement</strong>. La garantie
        s&apos;applique une seule fois par compte. Le remboursement met fin immédiatement à la formule : le compte repasse en
        version gratuite. Les factures déjà émises par l&apos;Utilisateur restent émises.
      </p>
      <h3>4.4 Défaut de paiement</h3>
      <p>
        En cas d&apos;échec d&apos;un paiement, de nouvelles tentatives ont lieu automatiquement et l&apos;Utilisateur conserve
        l&apos;usage de sa formule pendant ce délai. À défaut de régularisation, la formule prend fin et le compte repasse en
        version gratuite.
      </p>
      <h3>4.5 Résiliation et changement de formule</h3>
      <p>
        L&apos;Utilisateur peut résilier à tout moment depuis <strong>Paramètres → Abonnement</strong>, sans engagement. La
        résiliation prend effet à la fin de la période déjà payée, sans remboursement au prorata, sauf application de la
        garantie de l&apos;article 4.3 ou disposition légale contraire. Le passage d&apos;une période mensuelle à une période
        annuelle, ou d&apos;une formule à une autre, est calculé au prorata.
      </p>
      <h3>4.6 Accès aux documents après la fin d&apos;une formule</h3>
      <p>
        À la fin d&apos;une formule, pour quelque raison que ce soit, l&apos;Utilisateur conserve l&apos;accès en consultation et en
        téléchargement à l&apos;ensemble des documents émis, ainsi qu&apos;à l&apos;export comptable.
      </p>

      <h2>Article 5 — Obligations de l&apos;Utilisateur</h2>
      <p>L&apos;Utilisateur s&apos;engage à :</p>
      <ul>
        <li>Utiliser le Service conformément à la législation française en vigueur</li>
        <li>Ne pas tenter de contourner les limitations techniques ou les mécanismes de sécurité</li>
        <li>Ne pas utiliser le Service à des fins illicites, frauduleuses ou contraires aux bonnes mœurs</li>
        <li>S&apos;assurer de la conformité fiscale et comptable de ses propres documents (mentions obligatoires, TVA, etc.)</li>
        <li>Effectuer lui-même la transmission des factures sur la plateforme agréée de son choix</li>
      </ul>

      <h2>Article 6 — Propriété intellectuelle</h2>
      <p>
        L&apos;ensemble des éléments constitutifs du Service (code source, interfaces, graphismes, marques, logos) est la
        propriété exclusive de Qonforme SAS ou de ses concédants. Toute reproduction, représentation ou utilisation à des
        fins autres que l&apos;usage personnel du Service est interdite sans autorisation écrite préalable.
      </p>
      <p>
        Les documents créés par l&apos;Utilisateur (factures, devis, etc.) lui appartiennent intégralement. Qonforme ne
        revendique aucun droit sur leur contenu.
      </p>

      <h2>Article 7 — Protection des données personnelles (RGPD)</h2>
      <p>
        Qonforme collecte et traite les données personnelles nécessaires à la fourniture du Service (email, informations
        d&apos;entreprise, données de facturation). Ces données sont hébergées en Europe via Supabase et ne sont jamais vendues
        à des tiers.
      </p>
      <p>
        Conformément au Règlement (UE) 2016/679 (RGPD), l&apos;Utilisateur dispose d&apos;un droit d&apos;accès, de rectification,
        d&apos;effacement, de portabilité et d&apos;opposition, exerceable à <strong>privacy@qonforme.fr</strong>.
        Pour toute réclamation, l&apos;Utilisateur peut saisir la CNIL (www.cnil.fr).
      </p>

      <h2>Article 8 — Disponibilité et maintenance</h2>
      <p>
        Qonforme s&apos;efforce d&apos;assurer une disponibilité du Service 24h/24, 7j/7, mais ne peut garantir une absence totale
        d&apos;interruption. Des maintenances planifiées peuvent être réalisées avec un préavis raisonnable. Qonforme ne pourra
        être tenu responsable des interruptions imputables à des causes extérieures (hébergeur, fournisseur d&apos;accès, cas
        de force majeure).
      </p>

      <h2>Article 9 — Limitation de responsabilité</h2>
      <p>
        Qonforme est une plateforme outil. La responsabilité de la conformité fiscale et légale des documents émis
        incombe exclusivement à l&apos;Utilisateur. Qonforme ne saurait être tenu responsable d&apos;une erreur dans les informations
        renseignées par l&apos;Utilisateur, d&apos;un refus de transmission par une PDP ou Chorus Pro, ni des conséquences d&apos;un
        défaut de transmission dans les délais légaux.
      </p>
      <p>
        La responsabilité de Qonforme ne saurait excéder, toutes causes confondues, le montant des sommes effectivement
        versées par l&apos;Utilisateur au cours des 12 mois précédant le fait générateur.
      </p>

      <h2>Article 10 — Modification des CGU</h2>
      <p>
        Qonforme se réserve le droit de modifier les présentes CGU à tout moment. L&apos;Utilisateur sera notifié par e-mail
        ou via une bannière dans l&apos;application au moins 15 jours avant l&apos;entrée en vigueur des modifications. La poursuite
        de l&apos;utilisation du Service après ce délai vaut acceptation des nouvelles CGU.
      </p>

      <h2>Article 11 — Droit applicable et juridiction</h2>
      <p>
        Les présentes CGU sont soumises au droit français. En cas de litige, et à défaut de résolution amiable dans
        un délai de 30 jours, les tribunaux français compétents seront saisis. Pour les consommateurs, conformément à
        l&apos;article L.612-1 du Code de la consommation, un médiateur peut être saisi.
      </p>

      <h2>Article 12 — Contact</h2>
      <p>
        Pour toute question relative aux présentes CGU : <strong>contact@qonforme.fr</strong>
      </p>
    </LegalLayout>
  )
}
