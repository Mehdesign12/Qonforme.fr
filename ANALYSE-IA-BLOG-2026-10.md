# Choisir l'IA du blog : textes et images

> Décision appliquée le 09/10/2026 (`lib/seo/settings.ts`, section « articles ») : plan et contrôle par Gemini 3.8 Flash,
> rédaction par Claude Opus 5.5, couverture par Nano Banana 2.1 avec repli automatique sur Gemini 3.1 Flash Image
> (code stable). Le générateur historique (`lib/ai/gemini.ts`) passe du code « -preview » au code stable `gemini-3.1-flash-image`.
> Mention « Illustration générée par IA » sous la couverture des articles générés.

Relevé du 9 octobre 2026. Chaque chiffre porte sa source et la date de la donnée. Douze affirmations clés ont été revérifiées par une seconde lecture des sources (marquées « vérifié » ci-dessous) ; les autres viennent des six analyses de recherche initiales, sans seconde vérification. Quand une donnée manque, je le dis. **Ce rapport ne demande aucune migration SQL.**

## L'essentiel

- **Le prix ne départage pas les modèles.** On compte 8 articles par mois, en trois passes chacun. Même Claude Opus 5.5 coûte alors environ 2,4 $ par mois. Les modèles les moins chers coûtent environ 0,06 $. Il faut donc choisir sur la qualité d'écriture et sur l'exactitude.
- **Le modèle actuel (Gemini 2.5 Flash) est l'un des plus faibles mesurés** (vérifié).
  - Exactitude de 25,9 % sur AA-Omniscience ; il se trompe dans 75,3 % des réponses qu'il ne réussit pas avec raisonnement, 93,0 % sans raisonnement (exactitude 26,1 %) [AAG25].
  - Il est 135ᵉ en français sur Arena (1426, 2 619 votes) [AFR], 117ᵉ en écriture créative et 146ᵉ pour le respect des consignes [ACW].
  - Depuis le 18/09/2026, Google le réserverait aux comptes qui l'utilisaient déjà [CHG] (non revérifié).
- **Les 35 articles signalés sur 62 contiennent surtout des valeurs périmées.** C'est un problème de faits, pas de style. Changer de modèle ne suffira pas. Il faut aussi :
  - fournir au modèle les faits vérifiés dans la consigne ;
  - faire relire chaque article par un modèle d'une autre famille ;
  - garder le contrôle automatique `lib/blog-audit.ts`.
- **Les couvertures peuvent cesser de se générer à tout moment.** L'ancien générateur (`lib/ai/gemini.ts`) appelle encore `gemini-3.1-flash-image-preview`. Google indique pour ce code un arrêt « au plus tôt » le 25/06/2026 et désigne `gemini-nano-banana-2.1` comme remplaçant (vérifié) [DEP]. La date étant passée, Google peut le retirer à tout moment. Je n'ai pas vérifié par un appel réel s'il répond encore. Le nouveau registre du module Articles (`lib/seo/articles/model-registry.ts`) envoie déjà le code stable `gemini-3.1-flash-image` ; son commentaire écrit « arrêté le 25 juin 2026 », alors que la page de Google ne donne qu'une date au plus tôt.

---

## 1. Modèles texte candidats

**Comment lire le coût mensuel.** Il compte 8 articles par mois, en trois passes chacun : 144 000 jetons en entrée et 92 000 en sortie. Formule : 0,144 × prix d'entrée + 0,092 × prix de sortie. Pour Claude, la valeur entre parenthèses ajoute environ 30 % de jetons, à cause de son découpage du texte [H55]. Si le modèle réfléchit avant d'écrire, la sortie peut doubler.

**Comment lire la colonne « Fiabilité ».**
- « Exactitude / hallucination » vient du test AA-Omniscience d'Artificial Analysis [AAO]. Le taux d'hallucination est la part de réponses fausses parmi les réponses non correctes. Un taux bas peut donc venir d'un modèle qui s'abstient souvent.
- « Droit » est l'indice du domaine Law de ce test, de -100 à +100. Il porte surtout sur du droit anglo-saxon.
- « IF » est la note de respect des consignes de LiveBench, moyenne des 4 tâches de la catégorie (paraphrase, simplification, histoire, résumé) [LB]. Elle a été recalculée sur `table_2026_06_25.csv`, la dernière table publiée (datée du 25/06/2026 ; le relevé initial donnait un fichier modifié le 07/10/2026, ce qui expliquerait la présence de Haiku 5.5, sorti le 07/10/2026). La date réelle des mesures reste donc à confirmer.

| Modèle (identifiant API) | Prix entrée / sortie (par M jetons) | Rédaction | Français | Fiabilité | Coût mensuel estimé |
|---|---|---|---|---|---|
| **Claude Opus 5.5** (`claude-opus-5-5`) | 4 $ / 20 $ (vérifié) [PA] | Écriture créative Arena : 2ᵉ, 1517,2, rang possible 1 à 5, 1 480 votes (vérifié) [ACW]. EQ-Bench v3 : 7ᵉ sur 140, Elo 2050,1 ; tournures toutes faites (« slop ») : 10,43 (vérifié) [EQ]. Longform : 3ᵉ sur 140, 84,6 (vérifié) [EQL]. Mazur : 3ᵉ, 3,718 (vérifié) [MZ] | Arena FR : 11ᵉ, mais 201 votes seulement (±41) [AFR] | Exactitude 66,2 %, hallucination 58,6 %. Droit : 48,1 [AAO]. Score net AA-Omniscience publié par Anthropic : 0,58 [SC]. IF : 67,05 en xhigh, 65,7 en max (vérifié) [LB]. FACTS : 65,3 [FACTS] | 2,42 $ (3,14 $) |
| **Claude Sonnet 5.5** (`claude-sonnet-5-5`) | 2 $ / 10 $ (vérifié) [PA] | Écriture créative Arena : 24ᵉ, 1463 (rang possible 6 à 63, 1 079 votes) ; consignes : 13ᵉ [ACW]. Absent d'EQ-Bench et de Mazur | Non classé sur Arena FR [AFR]. Moyenne sur 42 langues : 92,1 % [SC] | En max : exactitude 53,9 %, hallucination 47,0 %. En high : hallucination 64,6 %. Droit : 26,6 [AAO]. Score net publié par Anthropic : 0,35 [SC]. SimpleQA : 44,7 % [SQA]. IF : 70,52 en xhigh, 56,8 en max (vérifié) [LB] | 1,21 $ (1,57 $) |
| **Gemini 3.8 Flash** (`gemini-3.8-flash`) | 0,75 $ / 3,75 $ jusqu'au 31/12/2026, puis 1,50 $ / 7,50 $ dès le 01/01/2027, réflexion comprise dans la sortie (vérifié) [PG] | Écriture créative Arena : 7ᵉ, 1487 [ACW]. EQ-Bench v3 : 30ᵉ sur 140, Elo 1747,9, slop 22,60 (vérifié) [EQ]. Longform : 25ᵉ, 76,8 [EQL]. Mazur : 26ᵉ sur 57 [MZ] | Arena FR, variante `gemini-3.8-flash-high` : 23ᵉ, 1503,8, rang possible 1 à 85, 984 votes, **marquée préliminaire** (vérifié) [AFR] | Exactitude 54,6 %, hallucination 55,2 %. Droit : 39,5 [AAO]. SimpleQA : 74,6 % [SQA]. FACTS : 69,4 [FACTS]. **IF : 81,41 en high, meilleur mesuré** (vérifié) [LB] | 0,45 $ (0,91 $ en 2027) |
| Gemini 3.7 Flash | Même prix que 3.8 Flash [PG] | Écriture créative Arena : 5ᵉ [ACW]. EQ-Bench v3 : 32ᵉ [EQ]. Mazur : 37ᵉ [MZ] | Arena FR : 10ᵉ, provisoire [AFR] | Hallucination 64,5 %, chiffre de BenchLM, confiance moyenne [BLM] | 0,45 $ |
| Claude Haiku 5.5 (`claude-haiku-5-5`) | 0,10 $ / 0,50 $ pour une requête de 100 000 jetons au plus ; au-delà, toute la requête passe à 0,50 $ / 2,50 $ (vérifié) [PA] | **Aucun score d'écriture** : sorti le 07/10/2026, absent d'Arena, d'EQ-Bench et de Mazur au 09/10/2026 (vérifié) [AAH]. Anthropic le présente pour la classification, l'extraction et le routage [H55] | Aucun classement. Moyenne sur 42 langues : 87,8 % [SC] | Artificial Analysis (effort max) : exactitude 36,4 %, hallucination 40,4 % (vérifié) [AAH]. Fiche système d'Anthropic : 44 % justes, 32 % fausses, 24 % d'abstentions, score net 0,12 (vérifié) [SC]. Droit : 1,6 [AAO]. IF : 66,47 en xhigh, 54,7 en max (vérifié) [LB] | 0,06 $ (0,08 $) |
| GPT-6 Luna (`gpt-6-luna`) | 0,10 $ / 0,50 $ [PO] | Écriture créative Arena : 89ᵉ [ACW] | Arena FR : 63ᵉ [AFR] | Exactitude 43,8 %, hallucination 76,7 %. Droit : -12 [AAO]. IF : 55,93 en max (vérifié) [LB] | 0,06 $ |
| DeepSeek V4.1 Flash (`deepseek-flash`) | 0,30 $ / 1,20 $ en heures pleines [PD] | Écriture créative Arena : 59ᵉ [ACW]. Longform : 30ᵉ, 74,0 [EQL]. Mazur : 32ᵉ [MZ] | Arena FR : 85ᵉ [AFR] | Exactitude 46,4 %, hallucination 96,5 %. Droit : -19,3 [AAO]. Données stockées en Chine [DSP] | 0,15 $ |
| Gemini 3.5 Flash-Lite (`gemini-3.5-flash-lite`) | 0,30 $ / 2,50 $ [PG] | Écriture créative Arena : 62ᵉ [ACW]. EQ-Bench v3 : 55ᵉ [EQ] | Arena FR : 59ᵉ [AFR] | Exactitude 29,5 %, hallucination 34,4 % [AAO]. SimpleQA : 33,1 % [SQA]. IF : 67,2 [LB] | 0,27 $ |
| GLM-5.3 Flash | 0,15 $ / 0,50 $ [PZ] | Écriture créative Arena : 65ᵉ [ACW] | Arena FR : 21ᵉ (rang possible 1 à 82) [AFR] | Exactitude 27,5 %, hallucination 27,6 %. Droit : -8,6 [AAO]. IF : 52,8 [LB] | environ 0,07 $ |
| Mistral Medium 3.5 | 1,50 $ / 7,50 $ [PM] | Écriture créative Arena : 110ᵉ [ACW]. Mazur : 50ᵉ sur 57 [MZ] | Arena FR : 119ᵉ [AFR] | Exactitude 24,7 %, hallucination 81,6 % [AAO]. Données dans l'UE par défaut [MIS] | 0,91 $ |
| *Actuel :* Gemini 2.5 Flash (`gemini-2.5-flash`) | 0,30 $ / 2,50 $ (vérifié) [PG] | Écriture créative Arena : 117ᵉ ; consignes : 146ᵉ [ACW]. EQ-Bench v3 : 107ᵉ sur 140 [EQ] | Arena FR : 135ᵉ, 1426,3, rang possible 91 à 181, 2 619 votes (vérifié) [AFR] | Exactitude 25,9 %, hallucination 75,3 % avec raisonnement ; 26,1 % et 93,0 % sans (vérifié) [AAG25]. SimpleQA : 28,1 % [SQA] | 0,27 $ |

Les autres modèles sont écartés :
- **GPT-6 Luna, DeepSeek V4.1 Flash, GPT-5.4 mini et Mistral Medium 3.5** inventent une réponse dans 76 à 97 % des cas où ils ne savent pas [AAO].
- **Kimi K3** coûte 3 $ / 15 $ [PK], au-dessus de la cible « peu coûteux ».
- **Gemini 4 Argon** est 1ᵉʳ en écriture créative sur Arena (1519,2), mais en préversion, sans prix ni disponibilité publique relevés [ACW].

**Remises possibles chez Anthropic (vérifié) [PA].** L'API par lots (Batch) divise les prix par deux. Une lecture en cache coûte 0,05 fois le prix d'entrée sur Opus 5.5 et Sonnet 5.5. Le blog n'étant pas urgent, la génération peut passer par lots.

## 2. Modèles d'images candidats

Le coût mensuel compte 8 couvertures par mois, comme dans l'analyse d'usage.

| Modèle (identifiant API) | Prix par image | Classement | Réalisme des personnes | Droits et marquage | Coût mensuel (8 images) |
|---|---|---|---|---|---|
| **Nano Banana 2.1** (`gemini-nano-banana-2.1`) | 0,0336 $ en 1K, 0,0504 $ en 2K, 0,113 $ en 4K (vérifié) ; moitié prix par lots [PG] | Artificial Analysis : 4ᵉ, Elo 1160 ±10, 6 055 apparitions (vérifié) [AAI]. Arena : 6ᵉ, 1328, provisoire [AI] | Photoréalisme : 4ᵉ, 1339 (2 055 votes) [AIP]. Portraits : 6ᵉ, 1337,4 (1 068 votes, intervalle 1318 à 1357, préversion) (vérifié) [AIPo] | Google ne revendique pas la propriété des images. Un service ouvert à des utilisateurs de l'EEE doit passer par l'offre payante [GT]. Filigrane SynthID sur toutes les images [GIG] | 0,27 $ (1K) / 0,40 $ (2K) |
| **GPT Image 2, qualité medium** (`gpt-image-2`) | 0,041 $ en 1536×1024 ou 1024×1536, 0,053 $ en 1024×1024 ; low 0,005 $, high 0,165 $ (vérifié) [OIG] | Arena : 3ᵉ, 1383, 93 334 votes, score stable [AI]. Artificial Analysis : 1172, mais en qualité high [AAI] | Photoréalisme : 3ᵉ, 1382 [AIP]. **Portraits : 3ᵉ, 1429,9, 17 754 votes** (vérifié) [AIPo] | L'image appartient au client [OSA]. Métadonnées C2PA et SynthID selon le centre d'aide d'OpenAI. Ces deux textes n'ont été lus que par extraits (page en erreur 403) | 0,33 $ |
| GPT Image 2.5 Sunburst | 0,21 $ en qualité max. Prix en medium non confirmé [AAI][PO] | Artificial Analysis : 1ᵉʳ, 1198 [AAI]. Arena : 1ᵉʳ, 1425, provisoire [AI] | Portraits : 1ᵉʳ, 1467 [AIPo] | Comme GPT Image 2 | environ 1,69 $ |
| MAI-Image-2.6 (Microsoft) | environ 0,039 $, préversion [MAI] | Artificial Analysis : 6ᵉ, 1151 [AAI]. Arena : 5ᵉ, 1332 [AI] | Portraits : 5ᵉ, 1346 [AIPo] | Conditions commerciales non trouvées | 0,31 $ |
| Muse Image (Meta) | 0,01 $ [MUSE] | Artificial Analysis : 8ᵉ, 1115 [AAI]. Arena : 9ᵉ, 1274 [AI] | Photoréalisme : 9ᵉ, 1284 [AIP] | Disponibilité dans l'UE, usage commercial et filigrane non documentés | 0,08 $ |
| FLUX.2 [pro] | à partir de 0,03 $ [BFL] | Artificial Analysis : 42ᵉ, 1004 [AAI]. Arena : 32ᵉ, 1153 [AI] | — | Usage commercial permis. BFL entraîne ses modèles sur les entrées et les images produites, sauf opposition par email [BFLT] | 0,24 $ |
| *Actuel :* Nano Banana 2 (`gemini-3.1-flash-image-preview`, code stable `gemini-3.1-flash-image`) | 0,067 $ en 1K, 0,101 $ en 2K (version stable, vérifié) [PG] | Artificial Analysis : 7ᵉ, 1126 [AAI] | — | Code « -preview » : arrêt au plus tôt le 25/06/2026, date passée (vérifié) [DEP] | 0,54 $ (1K) / 0,81 $ (2K) |

Exclus :
- **Imagen 4** : arrêt au plus tôt le 17/08/2026 [DEP].
- **Midjourney** : pas d'API officielle, et ses conditions interdisent les outils automatisés [MJ].

---

## 3. Recommandations

Les vérifications confirment la recommandation provisoire. Elles en nuancent deux arguments : le rang de Gemini 3.8 Flash en français est préliminaire et très incertain, et le chiffre de 36,4 % de Haiku 5.5 vient d'Artificial Analysis, pas d'Anthropic.

### Texte : répartir le travail par passe

Je recommande de confier chaque passe au modèle qui y est le meilleur.

| Passe | Modèle | Pourquoi | Coût mensuel (mon calcul) |
|---|---|---|---|
| Plan | Gemini 3.8 Flash (`gemini-3.8-flash`) | Meilleur respect des consignes mesuré (IF 81,41) [LB] et meilleures connaissances parmi les modèles bon marché (SimpleQA 74,6 %) [SQA] | 0,06 $ |
| Rédaction | **Claude Opus 5.5** (`claude-opus-5-5`) | Seul modèle dans le premier groupe des quatre classements d'écriture : 2ᵉ sur Arena, 7ᵉ sur EQ-Bench v3, 3ᵉ en Longform, 3ᵉ chez Mazur [ACW][EQ][EQL][MZ]. Le moins de tournures toutes faites : 10,43, contre 22,60 pour Gemini 3.8 Flash [EQ]. Meilleur score net d'Anthropic sur AA-Omniscience : 0,58, contre 0,35 pour Sonnet 5.5 et 0,12 pour Haiku 5.5 [SC] | 0,99 $ (1,29 $ avec le découpage Claude) |
| Contrôle | Gemini 3.8 Flash, puis `lib/blog-audit.ts` | Relecture par une autre famille de modèles, contre les faits de référence fournis. FACTS : 69,4 au score global [FACTS] (le relevé initial citait aussi 73,1 pour la seule fidélité à un texte fourni, chiffre non revérifié). Recherche Google gratuite jusqu'à 5 000 requêtes par mois [PG] | 0,20 $ |

**Total : environ 1,3 $ par mois en 2026, environ 1,5 à 1,8 $ en 2027** (hausse du prix de Gemini 3.8 Flash au 01/01/2027). Si les modèles réfléchissent avant d'écrire, comptez jusqu'à environ le double pour la sortie. Par lots chez Anthropic, la passe de rédaction coûte moitié moins [PA]. C'est mon calcul, à partir des prix [PA][PG] et du volume de l'analyse d'usage ; la répartition entre passes vient de cette analyse.

**Ce qu'il faut pour la mettre en place.** Une clé `ANTHROPIC_API_KEY` dans Vercel, en plus de `GEMINI_API_KEY`. Le registre `lib/seo/articles/model-registry.ts` connaît déjà `claude-opus-5-5`, mais pas encore `gemini-3.8-flash` : il faut l'y ajouter (même fournisseur, même clé).

**Modèle de secours : Gemini 3.8 Flash pour les trois passes.**
- Coût : 0,45 $ par mois, 0,91 $ en 2027.
- Il reste chez le même fournisseur. Le code utilise déjà l'API Gemini : il suffit de changer l'identifiant du modèle.
- C'est le meilleur modèle peu coûteux mesuré :
  - écriture créative : 7ᵉ sur Arena [ACW] ;
  - respect des consignes : 1ᵉʳ sur LiveBench (81,41) [LB] ;
  - connaissances : 74,6 % sur SimpleQA [SQA] ;
  - français : 23ᵉ sur Arena, mais avec 984 votes, un rang possible de 1 à 85 et un classement marqué préliminaire [AFR]. Ce chiffre ne prouve donc rien.
- Ses faiblesses :
  - plus de tournures toutes faites que les meilleurs (22,60) [EQ], et seulement 26ᵉ sur 57 chez Mazur [MZ] ;
  - jugé « very verbose » : 120 millions de jetons de sortie pour exécuter l'indice d'Artificial Analysis, contre 71 millions en médiane [G38R] (source tierce, non revérifiée).

**Le compromis entre prix et qualité.** Écrire avec Opus plutôt qu'avec Gemini 3.8 Flash coûte environ 1 $ de plus par mois. En échange, les quatre classements d'écriture sont nettement meilleurs. Sonnet 5.5 coûterait la moitié d'Opus, mais ses scores d'écriture sont presque inexistants : 1 079 votes sur Arena, rang possible de 6 à 63 [ACW]. Il ne donne donc aucune garantie mesurée.

**Pourquoi pas Claude Haiku 5.5 aujourd'hui.**
- Il n'a aucun score d'écriture : il est sorti le 07/10/2026 et ne figure encore dans aucun classement d'écriture [AAH].
- Sa fiche système écrit qu'il « hallucinated more than other recent models, and about as much as Claude Haiku 4.5 » [SC].
- Sur AA-Omniscience : 36,4 % d'exactitude selon Artificial Analysis [AAH] ; score net de 0,12 selon Anthropic, contre 0,58 pour Opus 5.5 [SC].
- Anthropic le destine à la classification et à l'extraction [H55].

À retester dans deux à quatre semaines, quand les classements l'auront intégré.

**Le risque d'erreurs reste entier quel que soit le modèle.** Tous les modèles bon marché inventent une réponse dans 27 à 97 % des cas où ils ne savent pas [AAO]. Opus lui-même est à 58,6 % [AAO]. Les modèles sont plus fiables quand ils s'appuient sur un texte fourni : selon le relevé initial, Gemini 2.5 Flash fait 70,0 sur FACTS Grounding mais seulement 42,2 de mémoire [FACTS] (non revérifié). Il faut donc :
1. donner au modèle les faits de référence vérifiés à chaque génération ;
2. ne jamais le laisser écrire « de mémoire » un seuil, un taux ou un article de loi ;
3. garder la mise en brouillon automatique de `lib/blog-audit.ts`.

**Avant de basculer**, faites un essai sur 5 sujets réels : même consigne, mêmes faits, trois configurations (hybride, Gemini 3.8 Flash seul, Sonnet 5.5 seul). Notez les articles avec `lib/blog-audit.ts` et par une relecture humaine.

### Images

**Modèle principal : Nano Banana 2.1 (`gemini-nano-banana-2.1`), à mettre en place tout de suite.**
- C'est le remplaçant désigné par Google pour le code actuel, dont l'arrêt peut intervenir à tout moment [DEP]. Même clé, même API.
- Il coûte 0,0504 $ en 2K, 0,0336 $ en 1K [PG], deux fois moins que Nano Banana 2 (0,067 $ / 0,101 $).
- C'est le meilleur score par dollar du top 10 d'Artificial Analysis : 1160 pour 0,0336 $ [AAI].
- Il est 4ᵉ en photoréalisme sur Arena [AIP].
- Le registre du module Articles le connaît déjà ; il reste à en faire le modèle par défaut (`DEFAULT_IMAGE_MODEL`) et à remplacer le code « -preview » dans `lib/ai/gemini.ts`.

**Modèle de secours : GPT Image 2 en qualité medium (`gpt-image-2`), à 0,041 $ en 1536×1024 [OIG].**
- Il est mieux classé sur des scores stables : 1383 sur Arena avec 93 334 votes [AI].
- Il est nettement devant sur les portraits : 1429,9 avec 17 754 votes, contre 1337,4 avec 1 068 votes pour Nano Banana 2.1 [AIPo].
- Il demande une clé OpenAI et un nouveau fournisseur dans le registre.

**Ce qui doit trancher : un test maison.** Faites noter les deux modèles sur 10 scènes de chantier : mains, outils, équipements de protection, aucun texte dans l'image. Si Nano Banana 2.1 est en retrait sur les personnes, GPT Image 2 devient le modèle principal. Le coût est négligeable dans les deux cas : moins de 0,50 $ par mois.

**Précaution juridique.** Ajoutez la mention « Illustration générée par IA » sous chaque couverture. Les obligations de transparence de l'article 50 de l'AI Act s'appliquent depuis le 02/08/2026 selon une source tierce [AIACT], avec une confiance moyenne ; savoir si une photo réaliste d'un artisan fictif est visée reste débattu.

---

## 4. Limites

- **Aucun classement public ne mesure la rédaction SEO ou marketing en français, ni l'exactitude fiscale et juridique française** (TVA, CGI, mentions obligatoires). Le domaine Law d'AA-Omniscience porte surtout sur du droit anglo-saxon.
- **EQ-Bench et Mazur ne testent que de la fiction en anglais.** EQ-Bench est noté par Claude (Sonnet 4.6 et Sonnet 4), sans correction du biais envers sa propre famille [EQA]. Cela peut avantager Opus. Arena, voté par des humains, le place pourtant aussi 2ᵉ [ACW].
- **Le classement français d'Arena est très imprécis.** Beaucoup de modèles peuvent y occuper n'importe quel rang entre 1 et 80 environ [AFR]. Opus 5.5 n'y a que 201 votes ; Gemini 3.8 Flash 984 votes, en préliminaire. Haiku 5.5 et Sonnet 5.5 n'y figurent pas.
- **FACTS et SimpleQA Verified sont conçus par Google DeepMind**, ce qui peut avantager Gemini. Ni Haiku 5.5 ni Sonnet 5.5 ne sont évalués sur FACTS.
- **Le respect des consignes n'a qu'une seule mesure récente** : LiveBench IF, dont la dernière table publiée porte la date du 25/06/2026. Artificial Analysis ne publie plus IFBench pour les modèles sortis après juillet 2026.
- **Les scores AA-Omniscience diffèrent selon la source.** Artificial Analysis et la fiche système d'Anthropic ne publient pas les mêmes chiffres pour un même modèle (Haiku 5.5 : 36,4 % d'exactitude chez l'un, 44 % de réponses justes sur la partie publique chez l'autre). Comparez toujours des chiffres de la même source.
- **Le coût réel dépend des jetons de réflexion,** qui ne sont publiés pour aucun modèle, et du découpage du français, non mesuré (environ +30 % pour Claude, en général).
- **Images :**
  - aucun test indépendant des mains ni des gestes de métier ;
  - les scores de Nano Banana 2.1 sont provisoires (le modèle est sorti le 06/10/2026), et son rang varie selon les sous-catégories d'Artificial Analysis ;
  - le prix de GPT Image 2.5 en qualité medium n'est pas confirmé ;
  - les conditions de Muse, MAI-Image-2.6 et Seedream n'ont pas été trouvées ;
  - les pages d'OpenAI sur les droits et le marquage n'ont été lues que par extraits ;
  - le prix de Seedream 5.0 Pro diverge : 0,045 $ selon OpenRouter, 0,09 $ selon Artificial Analysis.
- **Le prix de Mistral Large 4** (préversion) n'est pas tranché : 1,36 $ / 4,18 $, ou moitié moins avec la remise de lancement. Les deux chiffres viennent de sources tierces.
- **Les chiffres non marqués « vérifié »** viennent des analyses initiales et n'ont pas eu de seconde lecture.
- **Les montants sont en dollars US, hors taxes.** Je n'ai relevé aucun taux de change sourcé.

## Sources

**Prix**
- [PA] https://platform.claude.com/docs/en/about-claude/pricing (09/10/2026)
- [PG] https://ai.google.dev/gemini-api/docs/pricing (page mise à jour le 07/10/2026, lue le 09/10/2026)
- [PO] https://developers.openai.com/api/docs/pricing (09/10/2026)
- [PD] https://api-docs.deepseek.com/quick_start/pricing (09/10/2026)
- [PZ] https://docs.z.ai/guides/overview/pricing (09/10/2026)
- [PM] https://docs.mistral.ai/models/mistral-medium-3-5-26-04 (09/10/2026)
- [PK] https://platform.kimi.ai/docs/pricing/chat (09/10/2026)

**Classements d'écriture et de français**
- [ACW] https://arena.ai/leaderboard/text/creative-writing (mise à jour du 08/10/2026 ; aussi servi à https://arena.ai/leaderboard/chat/text/creative-writing)
- [AFR] https://arena.ai/leaderboard/text/french (08/10/2026)
- [EQ] https://eqbench.com/creative_writing.html (fichier de données v1.0.91, relevé le 09/10/2026)
- [EQL] https://eqbench.com/creative_writing_longform.html (24/09/2026)
- [EQA] https://eqbench.com/about.html (24/09/2026)
- [MZ] https://github.com/lechmazur/writing (dernière mise à jour du 08/10/2026)

**Fiabilité et respect des consignes**
- [AAO] https://artificialanalysis.ai/evaluations/omniscience (lu le 09/10/2026)
- [AAG25] https://artificialanalysis.ai/models/gemini-2-5-flash-reasoning (09/10/2026)
- [AAH] https://artificialanalysis.ai/models/claude-haiku-5-5 (09/10/2026)
- [LB] https://livebench.ai/ (table `table_2026_06_25.csv`, relevée le 09/10/2026)
- [SQA] https://www.kaggle.com/benchmarks/deepmind/simpleqa-verified (évaluations jusqu'au 05/10/2026)
- [FACTS] https://www.kaggle.com/benchmarks/google/facts/leaderboard (évaluations jusqu'au 29/09/2026)
- [BLM] https://benchlm.ai/benchmarks/omnisciencehallucinationrate (10/2026)
- [G38R] https://www.eesel.ai/blog/gemini-3-8-flash-review (08/09/2026)

**Fiches et documentation des modèles**
- [SC] Fiche système de Claude Haiku 5.5, 07/10/2026 : https://www-cdn.anthropic.com/e1080d6bf5ae2018ea3c2f414064be03232f5be5/Claude%20Haiku%205.5%20System%20Card.pdf (section 6.3.3, figures 6.3.3.1.A et B, p. 80) ; page d'accueil : https://www.anthropic.com/document/claude-haiku-5-5-system-card
- [H55] https://platform.claude.com/docs/en/models/haiku-5-5/overview (09/10/2026)
- [DEP] https://ai.google.dev/gemini-api/docs/deprecations (09/10/2026)
- [CHG] https://ai.google.dev/gemini-api/docs/changelog (18/09/2026)

**Données personnelles**
- [DSP] https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html (10/02/2026)
- [MIS] https://help.mistral.ai/en/articles/347629-where-do-you-store-my-data-or-my-organization-s-data (12/08/2026)

**Images**
- [AI] https://arena.ai/leaderboard/text-to-image (07/10/2026)
- [AIP] https://arena.ai/leaderboard/text-to-image/photorealistic (07/10/2026)
- [AIPo] https://arena.ai/leaderboard/text-to-image/portraits (07/10/2026)
- [AAI] https://artificialanalysis.ai/image/leaderboard/text-to-image (AA-Image-T2I v2.0, 09/10/2026)
- [OIG] https://developers.openai.com/api/docs/guides/image-generation (09/10/2026)
- [GIG] https://ai.google.dev/gemini-api/docs/image-generation (09/10/2026)
- [MAI] https://runtimewire.com/article/microsoft-mai-image-2-6-foundry-four-cents-image (09/2026)
- [MUSE] https://developer.meta.com/ai/resources/blog/build-with-muse-Image/ (25/08/2026)
- [BFL] https://docs.bfl.ai/quick_start/pricing (09/10/2026)
- [MJ] https://unifically.com/blogs/midjourney-api (09/2026)

**Droits et réglementation**
- [GT] https://ai.google.dev/gemini-api/terms (28/04/2026)
- [OSA] https://openai.com/policies/services-agreement/ (01/01/2026)
- [BFLT] https://bfl.ai/legal/flux-api-service-terms (01/08/2026)
- [AIACT] https://www.praxikon.com/en/posts/article-50-transparency-deadline-2-august-2026 (08/2026)
