# Idée mise de côté — générateur de demandes de devis pour l'artisan (10/11/2026)

> Statut : **idée enregistrée pour plus tard, rien n'est codé.** Proposée par le fondateur le 10/11/2026 (« ajouter un lead generator dans les options »). Trois questions restent à trancher avant toute maquette (voir à la fin).

## L'idée

Aider l'artisan à **trouver ses propres clients**, depuis Qonforme. Un artisan qui décroche des chantiers grâce à l'outil a une raison de plus de rester abonné.

Hypothèse retenue : l'outil sert **aux artisans**. Trouver des clients pour Qonforme lui-même est un autre sujet, et toujours **sans démarchage** (`DECISIONS-STRATEGIQUES.md` § 2 : ni appels ni emails à froid ; `lib/outreach` et `lib/scraping` restent désactivés).

## Première version proposée : la page de demande de devis de l'artisan

- **Une page publique par artisan**, par exemple `qonforme.fr/artisan/garnier-platrerie` : nom, métier, zone d'intervention, logo, assurance décennale (déjà dans le profil légal), quelques photos de chantier.
- **Un formulaire « Demander un devis »** : type de travaux, adresse du chantier, délai souhaité, photos, coordonnées.
- **Une boîte « Demandes »** dans l'application. En un clic, une demande devient un client et un brouillon de devis prérempli.
- **L'artisan diffuse lui-même son lien** : signature d'email, fiche Google, Facebook, carte de visite, QR code sur son camion, pied de ses devis et factures (à côté du lien « Propulsé par Qonforme »).
- **Ce qui la rend forte** : tout ce qui suit la demande existe déjà (devis, signature en ligne, acompte, facture). La demande se transforme en chantier signé sans quitter l'outil.

## Ce qui est déconseillé

- **Revendre des contacts de particuliers à plusieurs artisans** (modèle des plateformes de mise en relation) : il faut des visiteurs, donc un budget publicitaire, et un contrôle de qualité des demandes ; c'est un autre métier que le logiciel.
- **Une base d'entreprises à démarcher** : contraire à la règle « aucun démarchage », et même problème au regard du RGPD pour les artisans qui l'utiliseraient.

## Points à prévoir si on reprend

- **Données personnelles** : le formulaire collecte les coordonnées d'un particulier pour le compte de l'artisan. Mentions RGPD sur le formulaire (l'artisan est responsable du traitement, Qonforme sous-traitant), durée de conservation des demandes non suivies, politique de confidentialité et CGU à compléter.
- **Anti-spam** : même dispositif que la bulle de contact (champ piège, limites par adresse IP et par email, `lib/support-chat/`).
- **Traceurs** : page destinée aux clients de l'artisan, donc comme `/regler` et `/signer` : ni décor de marque Qonforme ni traceur publicitaire (`NO_TRACKING_PATHS`).
- **Référencement** : page indexable ou non, au choix de l'artisan ; si elle l'est, contenu propre à chaque artisan (pas de pages vides en série, cf. le nettoyage du pSEO du 15/10/2026).
- **Démo** : miroir de la boîte « Demandes » et d'une page artisan sur les données de `lib/demo`.

## À trancher par le fondateur

1. Outil pour les artisans (et non pour Qonforme) : confirmé ?
2. La page publique avec demande de devis comme première version : d'accord ?
3. Gratuite pour attirer les inscriptions, ou réservée à Essentiel pour pousser l'abonnement ?
