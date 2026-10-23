# Idée mise de côté — prix du bâtiment sans base payante (19/10/2026)

> Statut : **idée enregistrée pour plus tard, rien n'est codé.** Décision du fondateur : ne pas payer de licence (Batiprix, Artiprix, Tarifeo, Batitel). Document interne : ne jamais nommer ces éditeurs ni le concurrent dans un contenu public.

## Constat

- Aucune base d'ouvrages avec prix et temps de pose n'est gratuite. Batiprix (≈ 28 000 ouvrages, 9 lots de métiers) se vend en fichiers à intégrer dans un logiciel, sans API publique ; Artiprix (Batirama), Tarifeo (partenaire de la CAPEB depuis 2023) et Batitel sont aussi payantes. Tarifs relevés : Batiprix 1 224 € HT la bibliothèque complète, 308 € le lot (offre 2020, à revérifier) ; Artiprix de 299 à 556 € par an.
- Point P et Cedeo : aucune API publique trouvée. Un concurrent fait connecter à l'artisan son propre compte négoce pour récupérer ses prix négociés (mécanisme non documenté).
- Aucun jeu de données ouvert de bordereaux de prix du bâtiment sur data.gouv.fr.
- Copier une base payante ou afficher des « prix moyens du marché » pris sur des sites : exclu (droit des bases de données, règle « aucune affirmation invérifiable »).

## Pistes gratuites, par ordre de priorité

1. **Prix appris de l'artisan lui-même** — à la saisie d'une prestation, proposer son dernier prix, son prix moyen, sa marge et ses quantités habituelles, tirés de ses devis et factures. Aucune dépendance externe.
2. **Devis par IA sans prix inventé** — l'artisan décrit ou dicte le chantier, l'IA propose les lignes (ouvrage, unité, quantité) ; le prix vient de son historique, sinon « Prix à compléter » (même règle que l'import des 11 métiers, `lib/catalogue/trades.ts`).
3. **Import du fichier tarif de l'artisan** — CSV ou Excel de son fournisseur (beaucoup de fabricants livrent leurs données ETIM/BMEcat en Excel ou CSV sur demande), dans son catalogue personnel. Rien n'est redistribué.
4. **Réactualisation d'un vieux prix par les index BT de l'Insee** — « ce prix date de mars 2024, les coûts ont monté de x % ». API BDM gratuite (compte et jeton sur le catalogue d'API de l'Insee), données sous Licence Ouverte 2.0 : citer « Source : Insee » et la date de mise à jour. À vérifier à l'inscription : quotas et conditions de l'API. Les index BT sont des indices de coût, pas des prix d'ouvrages : ils réactualisent, ils ne chiffrent pas.
5. *(Faible)* Taux horaire de main-d'œuvre préremplis depuis les minima de salaires du bâtiment (accords régionaux IDCC 1596 et 1597) : ce sont des minima de salaire, pas des taux de vente ; aucune grille régionale complète trouvée.

## Pistes payantes ou à accord (écartées pour l'instant)

- Licence d'intégration auprès d'un éditeur de bibliothèque de prix (Batiprix, Artiprix, Tarifeo) : seule route vers une vraie base d'ouvrages ; demande de partenariat à faire par le fondateur.
- Connexion du compte négoce de l'artisan (Point P, Cedeo) : accord B2B avec chaque enseigne.

## Ordre proposé si on reprend

1 → 2 → 3, puis 4. Chaque étape est indépendante des autres.

## Sources consultées (19/10/2026)

Obat (Batiprix, Tarifeo, devis par IA), Appvizer, fiche EBP « Batiprix Data Connect », Independant.io (Artiprix), CAPEB (Tarifeo, index BT), Insee (catalogue d'API, service web BDM, mentions légales, structure du poste matériaux de l'index BT), data.gouv.fr (Licence Ouverte 2.0), aide de Tolteck (compte Point P et Cedeo), Weidmüller (ETIM/BMEcat), Éditions Tissot (salaires du bâtiment 2026).
